import type { RangeLimits, TimeRange } from '../timeline';
import { clampRange } from '../timeline';

/** The stretch of video a meme is made from (PRD §4.2): 2 to 15 seconds. */
export const MOMENT = {
  minLength: 2,
  maxLength: 15,
  /** Length of the selection a person starts with. */
  initialLength: 5,
} as const;

const safeDuration = (duration: number) =>
  Number.isFinite(duration) && duration > 0 ? duration : 0;

export function momentLimits(duration: number): RangeLimits {
  return {
    duration: safeDuration(duration),
    minLength: MOMENT.minLength,
    maxLength: MOMENT.maxLength,
  };
}

/** The first 5 seconds, or the whole video if it is shorter (even under 2 s). */
export function initialMoment(duration: number): TimeRange {
  const limits = momentLimits(duration);
  return clampRange(
    { start: 0, end: Math.min(limits.duration, MOMENT.initialLength) },
    limits,
    'end',
  );
}

const FALLBACK_FPS = 30;

/** Seconds per frame; 30 fps when the file does not say or says something implausible. */
export function frameDuration(fps: number | null): number {
  const rate = fps !== null && Number.isFinite(fps) && fps > 0 && fps <= 240 ? fps : FALLBACK_FPS;
  return 1 / rate;
}

/**
 * The time of the next (`+1`) or previous (`-1`) frame. Times are rounded up to the
 * millisecond, so they fall inside the frame: a time a hair before a frame's start
 * would show the frame before it.
 */
export function stepFrame(
  time: number,
  direction: 1 | -1,
  fps: number | null,
  duration: number,
): number {
  const frame = frameDuration(fps);
  // Index of the frame showing at `time`; the epsilon absorbs earlier ms rounding.
  const current = Math.floor(time / frame + 1e-6);
  const target = current + direction;
  const seconds = Math.ceil(target * frame * 1000 - 1e-6) / 1000;
  return Math.min(Math.max(seconds, 0), safeDuration(duration));
}
