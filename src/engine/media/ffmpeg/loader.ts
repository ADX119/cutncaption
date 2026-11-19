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

/**
 * How long the multi-thread core may take to start once its wasm is here. It normally
 * starts in a second or two; in WebKit under heavy load it has been seen never to
 * start. The single-thread core gets no limit: it has nothing to fall back to, and a
 * slow phone may need a while.
 */
export const MT_START_TIMEOUT_MS = 30_000;

/** Settles with `start`, or rejects with "stalled" if that takes longer than `ms`. */
export function startWithin<T>(start: Promise<T>, ms: number, what: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new EngineError('stalled', `${what} did not start within ${ms / 1000} s`)),
      ms,
    );
  });
  return Promise.race([start, timeout]).finally(() => clearTimeout(timer));
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
  #onLog: ((line: string) => void) | undefined;
  #terminated = false;

  private constructor(ffmpeg: FFmpeg, variant: CoreVariant) {
    this.#ffmpeg = ffmpeg;
    this.variant = variant;
    ffmpeg.on('log', ({ type, message }) => {
      this.#log.push(message);
      if (type === 'stdout') this.#stdout.push(message);
      this.#onLog?.(message);
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
      const loading = ffmpeg.load(
        {
          coreURL: location.coreURL,
          wasmURL,
          workerURL: location.workerURL,
        },
        { signal },
      );
      // After a timeout, terminate() makes this reject too; nobody is waiting for it then.
      loading.catch(() => undefined);
      await (variant === 'mt'
        ? startWithin(loading, MT_START_TIMEOUT_MS, 'the multi-thread core')
        : loading);
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

  /**
   * Runs one ffmpeg command line (without the leading "ffmpeg").  sees each
   * line as it arrives, for progress. Prefer runFfmpeg(), which adds progress,
   * cancellation and error mapping.
   */
  async exec(
    args: readonly string[],
    options: { readonly onLog?: (line: string) => void } = {},
  ): Promise<ExecResult> {
    if (this.#terminated) throw new EngineError('engine-load-failed', 'session was terminated');
    this.#log = [];
    this.#stdout = [];
    this.#onLog = options.onLog;
    try {
      const exitCode = await this.#ffmpeg.exec([...args]);
      return { exitCode, log: this.#log, stdout: this.#stdout };
    } finally {
      this.#onLog = undefined;
    }
  }

  /** Log of the most recent command, including a run that threw. */
  get lastLog(): readonly string[] {
    return this.#log;
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
