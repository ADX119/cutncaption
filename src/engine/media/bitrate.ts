/**
 * Bitrate planning for "compress to size" (docs/ARCHITECTURE.md §7).
 *
 * The output must come in under the target: bitrate x duration plus container
 * overhead. A 4% margin covers the overhead; a corrective second pass (see
 * correctedVideoKbps) handles encoders that overshoot.
 */

/** Below this video bitrate the picture breaks up; refuse rather than produce mush. */
export const MIN_VIDEO_KBPS = 150;
const OVERHEAD = 0.96;
const AUDIO_KBPS = 96;
const LOW_AUDIO_KBPS = 64;
/** Below this total bitrate, audio drops to the lower rate to leave room for video. */
const LOW_AUDIO_BELOW_KBPS = 400;

/** Highest short side a video bitrate can carry well. */
const HEIGHT_LADDER: ReadonlyArray<readonly [minKbps: number, shortSide: number]> = [
  [2500, 1080],
  [1200, 720],
  [600, 480],
  [300, 360],
  [0, 240],
];

export type BitratePlan =
  | { readonly kind: 'already-small' }
  | {
      readonly kind: 'unreachable';
      /** The smallest target that would still give a watchable result. */
      readonly smallestBytes: number;
    }
  | {
      readonly kind: 'ok';
      readonly videoKbps: number;
      /** 0 when the source has no audio. */
      readonly audioKbps: number;
      /** Short side the picture should be scaled to (before the device and source caps). */
      readonly maxShortSide: number;
    };

export interface BitrateInput {
  readonly targetBytes: number;
  readonly durationSec: number;
  readonly sourceBytes: number;
  readonly hasAudio: boolean;
}

export function planBitrate(input: BitrateInput): BitratePlan {
  const { targetBytes, durationSec, sourceBytes, hasAudio } = input;
  if (sourceBytes <= targetBytes) return { kind: 'already-small' };

  const smallestBytes = Math.ceil(
    ((((MIN_VIDEO_KBPS + (hasAudio ? LOW_AUDIO_KBPS : 0)) * 1000) / 8) * durationSec) / OVERHEAD,
  );
  if (!(durationSec > 0)) return { kind: 'unreachable', smallestBytes };

  const totalKbps = (targetBytes * 8 * OVERHEAD) / durationSec / 1000;
  const audioKbps = hasAudio ? (totalKbps < LOW_AUDIO_BELOW_KBPS ? LOW_AUDIO_KBPS : AUDIO_KBPS) : 0;
  const videoKbps = Math.floor(totalKbps - audioKbps);
  if (videoKbps < MIN_VIDEO_KBPS) return { kind: 'unreachable', smallestBytes };

  const [, maxShortSide] = HEIGHT_LADDER.find(([minKbps]) => videoKbps >= minKbps) ?? [0, 240];
  return { kind: 'ok', videoKbps, audioKbps, maxShortSide };
}

/**
 * The video bitrate for a second pass when the first came out too big: scaled by how
 * far it overshot, with 7% extra margin. Never below the watchable minimum.
 */
export function correctedVideoKbps(
  videoKbps: number,
  targetBytes: number,
  actualBytes: number,
): number {
  if (actualBytes <= 0) return videoKbps;
  return Math.max(MIN_VIDEO_KBPS, Math.floor(videoKbps * (targetBytes / actualBytes) * 0.93));
}
