import {
  type Capabilities,
  type DeviceClass,
  type LimitCheck,
  LIMITS,
  type LimitIssue,
  checkLimits,
  classifyDevice,
  detectCapabilities,
  isIos,
  readDeviceEnv,
} from '../device';
import { type AssetProgress, assets } from '../assets';
import { EngineError } from '../errors';
import { type CorePolicy, runOnCore } from './ffmpeg/fallback';
import { type CoreVariant, FfmpegSession, coreLocation } from './ffmpeg/loader';
import { runFfmpeg } from './ffmpeg/run';
import { chooseCoreVariant } from './ffmpeg/variant';
import { withWorkspace } from './ffmpeg/workspace';
import type { EnginePath, JobResult, MediaJob } from './jobs';
import { renderOverlay } from './overlay';
import { OVERLAY_FILE, type Plan, type Refusal, planJob } from './plan';
import type { MediaInfo } from './probe/parse';
import { probeFile } from './probe/probe';

/** A hard device limit, as the error the UI shows. */
function limitError(issue: LimitIssue): EngineError {
  const detail = `${issue.actual} > ${issue.limit}`;
  switch (issue.code) {
    case 'input-too-large':
    case 'output-too-large':
    case 'caption-audio-too-long':
      return new EngineError(issue.code, detail);
    case 'reencode-too-long':
      // A warning, never a block; listed so a new limit code fails to compile here.
      return new EngineError('job-failed', `unexpected block ${issue.code}: ${detail}`);
  }
}

function describeRefusal(refusal: Refusal): string {
  switch (refusal.code) {
    case 'target-unreachable':
      return `smallest workable size ${refusal.smallestBytes} bytes`;
    case 'already-under-target':
      return 'source already under target';
    case 'no-audio':
      return 'source has no audio stream';
    case 'no-video':
      return 'source has no video stream';
    case 'already-silent':
      return 'source already has no audio';
  }
}

export interface Assessment extends LimitCheck {
  readonly path: EnginePath;
  /** Why the job would not run at all (compress to size: already small, or target too small). */
  readonly refusal: Refusal | undefined;
  /** Rough size of the result, for showing before the job runs. */
  readonly estimatedOutputBytes: number | undefined;
}

export interface RunJobOptions {
  readonly signal?: AbortSignal;
  readonly onProgress?: (fraction: number) => void;
}

/** The only way features touch media processing (docs/ARCHITECTURE.md §3). */
export interface MediaEngine {
  /** Reads duration, streams and rotation. Call once when a file is chosen. */
  probe(file: File, options?: { readonly signal?: AbortSignal }): Promise<MediaInfo>;
  /** What running this job would mean on this device: path, and any limit problems. */
  assess(job: MediaJob): Assessment;
  /** Runs a job. One at a time: a second call while one runs rejects with "busy". */
  run(job: MediaJob, options?: RunJobOptions): Promise<JobResult>;
  /**
   * Whether getting ready will download the engine (first visit, or the cache was
   * cleared). Use it to decide whether to show download progress.
   */
  needsDownload(): Promise<boolean>;
  /**
   * Loads the core this device will use for re-encoding, so the first job starts at
   * once. Reports download progress when the engine is not cached yet.
   */
  prepare(options?: {
    readonly signal?: AbortSignal;
    readonly onDownload?: (progress: AssetProgress) => void;
  }): Promise<void>;
  /** Frees the ffmpeg instance and its memory. The engine reloads it when next needed. */
  release(): void;
}

export interface MediaEngineDeps {
  readonly deviceClass: DeviceClass;
  readonly capabilities: Pick<Capabilities, 'crossOriginIsolated' | 'sharedArrayBuffer'>;
  readonly ios: boolean;
  readonly loadSession: (
    variant: CoreVariant,
    options?: { readonly signal?: AbortSignal; readonly onDownload?: (p: AssetProgress) => void },
  ) => Promise<FfmpegSession>;
  /** Whether a core's wasm is already on this device, so loading needs no download. */
  readonly isCoreCached: (variant: CoreVariant) => Promise<boolean>;
}

function defaultDeps(): MediaEngineDeps {
  const env = readDeviceEnv();
  return {
    deviceClass: classifyDevice(env),
    capabilities: detectCapabilities(),
    ios: isIos(env),
    loadSession: (variant, options = {}) =>
      FfmpegSession.load({ variant, signal: options.signal, onProgress: options.onDownload }),
    isCoreCached: (variant) =>
      assets().isCached(coreLocation(variant, globalThis.location.origin).wasmKey),
  };
}

export function createMediaEngine(deps: MediaEngineDeps = defaultDeps()): MediaEngine {
  const policy: CorePolicy = { multiThreadDisabled: false };
  const planContext = { maxShortSide: LIMITS[deps.deviceClass].maxEncodeShortSide };
  let session: FfmpegSession | undefined;
  let busy = false;

  /**
   * A live session of the requested core. Only one is ever held: switching cores
   * frees the other, and a cancelled or stalled session is replaced.
   */
  async function getSession(
    variant: CoreVariant,
    signal?: AbortSignal,
    onDownload?: (p: AssetProgress) => void,
  ) {
    const live = session && !session.terminated ? session : undefined;
    // A loaded multi-thread core can do single-thread work too (threads are capped),
    // so never download the single-thread core just for that.
    if (live && (live.variant === variant || variant === 'st')) return live;
    live?.terminate();
    try {
      session = await deps.loadSession(variant, { signal, onDownload });
    } catch (error) {
      // A multi-thread core that never starts is treated like one that stalls:
      // single-thread for the rest of the visit.
      const stalled = error instanceof EngineError && error.code === 'stalled';
      if (variant !== 'mt' || !stalled) throw error;
      policy.multiThreadDisabled = true;
      session = await deps.loadSession('st', { signal, onDownload });
    }
    return session;
  }

  /** Any live session will do for probing; prefer not to load a second one. */
  async function anySession(signal?: AbortSignal) {
    if (session && !session.terminated) return session;
    return getSession('st', signal);
  }

  async function exclusive<T>(work: () => Promise<T>): Promise<T> {
    if (busy) throw new EngineError('busy', 'a job is already running');
    busy = true;
    try {
      return await work();
    } finally {
      busy = false;
    }
  }

  function variantFor(reencodesVideo: boolean): CoreVariant {
    return chooseCoreVariant({
      capabilities: deps.capabilities,
      deviceClass: deps.deviceClass,
      ios: deps.ios,
      reencodesVideo,
      multiThreadDisabled: policy.multiThreadDisabled,
    });
  }

  return {
    probe(file, options = {}) {
      return exclusive(async () => probeFile(await anySession(options.signal), file));
    },

    assess(job) {
      const plan = planJob(job, planContext);
      const limits = checkLimits(deps.deviceClass, plan.footprint);
      const path: EnginePath =
        plan.path === 'copy' ? 'copy' : `ffmpeg-${variantFor(plan.reencodesVideo)}`;
      return {
        ...limits,
        path,
        estimatedOutputBytes: plan.footprint.estimatedOutputBytes,
        refusal: plan.refusal,
      };
    },

    run(job, options = {}) {
      return exclusive(async () => {
        const started = performance.now();
        const plan = planJob(job, planContext);
        if (plan.refusal) throw new EngineError(plan.refusal.code, describeRefusal(plan.refusal));

        const [block] = checkLimits(deps.deviceClass, plan.footprint).blocks;
        if (block) throw limitError(block);

        // The caption layer is drawn once, on this thread with the page's fonts.
        const overlay = plan.overlay ? await renderOverlay(plan.overlay) : undefined;
        const overlayBytes = overlay ? new Uint8Array(await overlay.blob.arrayBuffer()) : undefined;

        const {
          value: blob,
          variant,
          fellBack,
        } = await runOnCore({
          variant: variantFor(plan.reencodesVideo),
          policy,
          getSession: (v) => getSession(v, options.signal),
          job: (live) =>
            withWorkspace(live.fs, [job.file], async (ws) => {
              // A copy each time: writeFile hands the buffer to the worker, and a
              // fallback to the single-thread core needs it again.
              if (overlayBytes) await ws.writeFile(OVERLAY_FILE, overlayBytes.slice());
              // A plan may ask for one corrective pass (compress to size overshot).
              let current: Plan | null = plan;
              let output: Blob | undefined;
              while (current) {
                await runFfmpeg(live, current.args(ws, overlay), {
                  expectedDurationSec: current.expectedDurationSec,
                  signal: options.signal,
                  onProgress: options.onProgress,
                });
                output = await ws.readOutput(current.outputName, current.mime);
                current = current.retry?.(output.size) ?? null;
              }
              if (!output) throw new EngineError('job-failed', 'no output');
              return output;
            }),
        });

        return {
          blob,
          filename: plan.filename,
          mime: plan.mime,
          path: plan.path === 'copy' ? 'copy' : `ffmpeg-${variant}`,
          ms: Math.round(performance.now() - started),
          fellBack,
        };
      });
    },

    async needsDownload() {
      return !(await deps.isCoreCached(variantFor(true)));
    },

    prepare(options = {}) {
      return exclusive(async () => {
        await getSession(variantFor(true), options.signal, options.onDownload);
      });
    },

    release() {
      session?.terminate();
      session = undefined;
    },
  };
}
