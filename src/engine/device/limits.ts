import type { DeviceClass } from './classify';

const MB = 1024 * 1024;
const GB = 1024 * MB;
const MIN = 60;

export type WhisperTier = 'base' | 'small';

export interface DeviceLimits {
  /** Hard: larger inputs are refused. */
  readonly maxInputBytes: number;
  /** Hard: outputs are held in memory, so the estimate must fit. */
  readonly maxOutputBytes: number;
  /** Warn: longer re-encodes are allowed but may be slow or fail. */
  readonly maxReencodeSeconds: number;
  /** Clamp: encodes are scaled down to this short side. */
  readonly maxEncodeShortSide: number;
  /** Hard: longer audio is refused for auto captions. */
  readonly maxCaptionAudioSeconds: number;
  /** Tiers that may be offered; `small` additionally needs WebGPU (decided in engine/ai). */
  readonly whisperTiers: readonly WhisperTier[];
}

/**
 * The only place device limits are defined (docs/ARCHITECTURE.md §8).
 * Starting values, to be calibrated on real devices in M5.14.
 */
export const LIMITS: Readonly<Record<DeviceClass, DeviceLimits>> = {
  L: {
    maxInputBytes: 500 * MB,
    maxOutputBytes: 150 * MB,
    maxReencodeSeconds: 3 * MIN,
    maxEncodeShortSide: 720,
    maxCaptionAudioSeconds: 10 * MIN,
    whisperTiers: ['base'],
  },
  M: {
    maxInputBytes: 1 * GB,
    maxOutputBytes: 300 * MB,
    maxReencodeSeconds: 10 * MIN,
    maxEncodeShortSide: 1080,
    maxCaptionAudioSeconds: 30 * MIN,
    whisperTiers: ['base'],
  },
  H: {
    maxInputBytes: 2 * GB,
    maxOutputBytes: 1 * GB,
    maxReencodeSeconds: 30 * MIN,
    maxEncodeShortSide: 1080,
    maxCaptionAudioSeconds: 60 * MIN,
    whisperTiers: ['base', 'small'],
  },
};

export type LimitCode =
  'input-too-large' | 'output-too-large' | 'caption-audio-too-long' | 'reencode-too-long';

export interface LimitIssue {
  readonly code: LimitCode;
  readonly limit: number;
  readonly actual: number;
}

/** What a job is about to do. Omit a field when it does not apply to the job. */
export interface JobFootprint {
  readonly inputBytes: number;
  readonly estimatedOutputBytes?: number;
  /** Seconds of video that will be re-encoded (not stream-copied). */
  readonly reencodeSeconds?: number;
  /** Seconds of audio that will be transcribed. */
  readonly captionAudioSeconds?: number;
}

export interface LimitCheck {
  /** Hard limits exceeded: the job must not start. */
  readonly blocks: readonly LimitIssue[];
  /** Soft limits exceeded: the user may continue. */
  readonly warnings: readonly LimitIssue[];
}

export function checkLimits(cls: DeviceClass, job: JobFootprint): LimitCheck {
  const limits = LIMITS[cls];
  const blocks: LimitIssue[] = [];
  const warnings: LimitIssue[] = [];

  const over = (code: LimitCode, actual: number | undefined, limit: number, into: LimitIssue[]) => {
    if (actual !== undefined && actual > limit) into.push({ code, limit, actual });
  };

  over('input-too-large', job.inputBytes, limits.maxInputBytes, blocks);
  over('output-too-large', job.estimatedOutputBytes, limits.maxOutputBytes, blocks);
  over('caption-audio-too-long', job.captionAudioSeconds, limits.maxCaptionAudioSeconds, blocks);
  over('reencode-too-long', job.reencodeSeconds, limits.maxReencodeSeconds, warnings);

  return { blocks, warnings };
}

/** Clamp limit: the short side an encode may use on this device (never upscales). */
export function clampShortSide(cls: DeviceClass, shortSide: number): number {
  return Math.min(shortSide, LIMITS[cls].maxEncodeShortSide);
}
