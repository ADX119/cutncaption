import {
  type Capabilities,
  type DeviceClass,
  type LimitCheck,
  type LimitIssue,
  checkLimits,
  classifyDevice,
  detectCapabilities,
  isIos,
  readDeviceEnv,
} from '../device';
import { EngineError } from '../errors';
import { type CorePolicy, runOnCore } from './ffmpeg/fallback';
import { type CoreVariant, FfmpegSession } from './ffmpeg/loader';
import { runFfmpeg } from './ffmpeg/run';
import { chooseCoreVariant } from './ffmpeg/variant';
import { withWorkspace } from './ffmpeg/workspace';
import type { EnginePath, JobResult, MediaJob } from './jobs';
import { planJob } from './plan';
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

export interface Assessment extends LimitCheck {
  readonly path: EnginePath;
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
  /** Frees the ffmpeg instance and its memory. The engine reloads it when next needed. */
  release(): void;
}

export interface MediaEngineDeps {
  readonly deviceClass: DeviceClass;
  readonly capabilities: Pick<Capabilities, 'crossOriginIsolated' | 'sharedArrayBuffer'>;
  readonly ios: boolean;
  readonly loadSession: (variant: CoreVariant, signal?: AbortSignal) => Promise<FfmpegSession>;
}

function defaultDeps(): MediaEngineDeps {
  const env = readDeviceEnv();
  return {
    deviceClass: classifyDevice(env),
    capabilities: detectCapabilities(),
    ios: isIos(env),
    loadSession: (variant, signal) => FfmpegSession.load({ variant, signal }),
  };
}

export function createMediaEngine(deps: MediaEngineDeps = defaultDeps()): MediaEngine {
  const policy: CorePolicy = { multiThreadDisabled: false };
  let session: FfmpegSession | undefined;
  let busy = false;

  /**
   * A live session of the requested core. Only one is ever held: switching cores
   * frees the other, and a cancelled or stalled session is replaced.
   */
  async function getSession(variant: CoreVariant, signal?: AbortSignal) {
    if (session && !session.terminated && session.variant === variant) return session;
    session?.terminate();
    session = await deps.loadSession(variant, signal);
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
      const plan = planJob(job);
      const limits = checkLimits(deps.deviceClass, plan.footprint);
      const path: EnginePath =
        plan.path === 'copy' ? 'copy' : `ffmpeg-${variantFor(plan.reencodesVideo)}`;
      return { ...limits, path };
    },

    run(job, options = {}) {
      return exclusive(async () => {
        const started = performance.now();
        const plan = planJob(job);

        const [block] = checkLimits(deps.deviceClass, plan.footprint).blocks;
        if (block) throw limitError(block);

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
              await runFfmpeg(live, plan.args(ws), {
                expectedDurationSec: plan.expectedDurationSec,
                signal: options.signal,
                onProgress: options.onProgress,
              });
              return ws.readOutput(plan.outputName, plan.mime);
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

    release() {
      session?.terminate();
      session = undefined;
    },
  };
}
