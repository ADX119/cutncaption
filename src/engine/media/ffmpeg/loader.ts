import type { FFFSType, FFmpeg } from '@ffmpeg/ffmpeg';
import { type AssetLoader, type AssetProgress, assets } from '../../assets';
import { EngineError, isEngineError } from '../../errors';
import vendor from './vendor.json';
import type { WorkspaceFs } from './workspace';

/** `st` = single-thread core (works everywhere), `mt` = multi-thread (needs isolation). */
export type CoreVariant = 'st' | 'mt';

export interface CoreLocation {
  /** The ffmpeg.wasm wrapper module. Its worker script sits beside it. */
  readonly wrapperURL: string;
  /** ES module that creates the ffmpeg core. */
  readonly coreURL: string;
  /** Thread worker script; only the multi-thread core has one. */
  readonly workerURL?: string;
  /** Manifest key of the wasm binary, fetched through the asset loader. */
  readonly wasmKey: string;
}

/**
 * Where each piece of a core lives. The small scripts are on the site's own origin
 * (scripts/vendor-copy.mjs); the wasm comes from /assets via the asset loader.
 * URLs are absolute because they are used from inside workers and module imports.
 */
export function coreLocation(variant: CoreVariant, origin: string): CoreLocation {
  const base = `${origin}${vendor.vendorBase}`;
  return {
    wrapperURL: `${base}/class/index.js`,
    coreURL: `${base}/${variant}/ffmpeg-core.js`,
    workerURL: variant === 'mt' ? `${base}/mt/ffmpeg-core.worker.js` : undefined,
    wasmKey: `${vendor.assetPrefix}/${variant}/ffmpeg-core.wasm`,
  };
}

export interface LoadFfmpegOptions {
  readonly variant: CoreVariant;
  readonly signal?: AbortSignal;
  /** Download progress of the wasm binary. Reported once, complete, when cached. */
  readonly onProgress?: (progress: AssetProgress) => void;
  /** Defaults to the app's loader; tests can pass another. */
  readonly assetLoader?: AssetLoader;
}

export interface ExecResult {
  readonly exitCode: number;
  /** Everything ffmpeg printed during this run, in order. */
  readonly log: readonly string[];
  /** Only what the program wrote to standard output (ffprobe's report). */
  readonly stdout: readonly string[];
}

/**
 * One loaded ffmpeg instance. The wrapper runs ffmpeg in its own worker, so nothing
 * here blocks the page. Wasm memory never shrinks: call terminate() to give it back.
 */
export class FfmpegSession {
  readonly variant: CoreVariant;
  readonly #ffmpeg: FFmpeg;
  #log: string[] = [];
  #stdout: string[] = [];
  #terminated = false;

  private constructor(ffmpeg: FFmpeg, variant: CoreVariant) {
    this.#ffmpeg = ffmpeg;
    this.variant = variant;
    ffmpeg.on('log', ({ type, message }) => {
      this.#log.push(message);
      if (type === 'stdout') this.#stdout.push(message);
    });
  }

  static async load(options: LoadFfmpegOptions): Promise<FfmpegSession> {
    const { variant, signal, onProgress } = options;
    const location = coreLocation(variant, globalThis.location.origin);

    const wasm = await (options.assetLoader ?? assets()).fetchAsset(location.wasmKey, {
      signal,
      onProgress,
    });

    // The wrapper is loaded at runtime from our own /vendor folder as a native ES
    // module and is deliberately not bundled: bundlers cannot process the way it
    // starts its worker. The npm package is used for its types only.
    let ffmpeg: FFmpeg;
    try {
      const wrapper = (await import(
        /* webpackIgnore: true */ /* turbopackIgnore: true */ location.wrapperURL
      )) as typeof import('@ffmpeg/ffmpeg');
      ffmpeg = new wrapper.FFmpeg();
    } catch (error) {
      throw new EngineError('engine-load-failed', `wrapper: ${String(error)}`, { cause: error });
    }
    // The worker reads the wasm from this object URL; it is only needed during load.
    const wasmURL = URL.createObjectURL(wasm);
    try {
      await ffmpeg.load(
        {
          coreURL: location.coreURL,
          wasmURL,
          workerURL: location.workerURL,
        },
        { signal },
      );
    } catch (error) {
      ffmpeg.terminate();
      if (isEngineError(error)) throw error;
      if (signal?.aborted) throw new EngineError('cancelled', 'ffmpeg load', { cause: error });
      throw new EngineError('engine-load-failed', `${variant}: ${String(error)}`, { cause: error });
    } finally {
      URL.revokeObjectURL(wasmURL);
    }
    return new FfmpegSession(ffmpeg, variant);
  }

  get terminated(): boolean {
    return this.#terminated;
  }

  /** ffmpeg's virtual file system, for withWorkspace(). */
  get fs(): WorkspaceFs {
    const ffmpeg = this.#ffmpeg;
    return {
      createDir: (path) => ffmpeg.createDir(path),
      deleteDir: (path) => ffmpeg.deleteDir(path),
      // The enum value is the plain string; the wrapper's enum is not imported at runtime.
      mountFiles: (files, mountPoint) =>
        ffmpeg.mount('WORKERFS' as FFFSType, { files: [...files] }, mountPoint),
      unmount: (mountPoint) => ffmpeg.unmount(mountPoint),
      writeFile: (path, data) => ffmpeg.writeFile(path, data),
      readFile: async (path) => {
        const data = await ffmpeg.readFile(path);
        if (typeof data === 'string') throw new Error(`readFile ${path}: expected binary`);
        return data;
      },
      deleteFile: (path) => ffmpeg.deleteFile(path),
      listDir: (path) => ffmpeg.listDir(path),
    };
  }

  /** Runs one ffmpeg command line (without the leading "ffmpeg"). */
  async exec(args: readonly string[]): Promise<ExecResult> {
    if (this.#terminated) throw new EngineError('engine-load-failed', 'session was terminated');
    this.#log = [];
    this.#stdout = [];
    const exitCode = await this.#ffmpeg.exec([...args]);
    return { exitCode, log: this.#log, stdout: this.#stdout };
  }

  /**
   * Runs one ffprobe command line (without the leading "ffprobe").
   * In this build ffprobe returns -1 even on success and ignores -o, so callers must
   * judge success by the report it prints on stdout, not by the exit code.
   */
  async ffprobe(args: readonly string[]): Promise<ExecResult> {
    if (this.#terminated) throw new EngineError('engine-load-failed', 'session was terminated');
    this.#log = [];
    this.#stdout = [];
    const exitCode = await this.#ffmpeg.ffprobe([...args]);
    return { exitCode, log: this.#log, stdout: this.#stdout };
  }

  /** Stops the worker and frees its memory. The session cannot be used afterwards. */
  terminate(): void {
    if (this.#terminated) return;
    this.#terminated = true;
    this.#ffmpeg.terminate();
  }
}
