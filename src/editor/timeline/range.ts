/** A selected stretch of a video, in seconds. */
export interface TimeRange {
  readonly start: number;
  readonly end: number;
}

export interface RangeLimits {
  /** Length of the whole video. */
  readonly duration: number;
  /** Shortest allowed selection. Default 0.1 s. */
  readonly minLength?: number;
  /** Longest allowed selection (Meme Studio: 15 s). Default: no limit. */
  readonly maxLength?: number;
}

/** Which part of a range a change came from; the other end stays put if it can. */
export type RangeEdge = 'start' | 'end';

const DEFAULT_MIN = 0.1;

/** Millisecond precision: enough for frames, and keeps values stable in tests and UI. */
const round = (seconds: number) => Math.round(seconds * 1000) / 1000;
const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

/**
 * Brings a range back inside the limits after one edge moved. The moved edge is
 * clamped; the other stays unless the video is too short for the minimum length.
 */
export function clampRange(range: TimeRange, limits: RangeLimits, moved: RangeEdge): TimeRange {
  const duration = Math.max(0, limits.duration);
  const minLength = Math.min(limits.minLength ?? DEFAULT_MIN, duration);
  const maxLength = Math.max(limits.maxLength ?? Infinity, minLength);

  if (moved === 'start') {
    const end = clamp(range.end, minLength, duration);
    const start = clamp(range.start, Math.max(0, end - maxLength), end - minLength);
    return { start: round(start), end: round(end) };
  }
  const start = clamp(range.start, 0, duration - minLength);
  const end = clamp(range.end, start + minLength, Math.min(duration, start + maxLength));
  return { start: round(start), end: round(end) };
}

/** Moves one edge by `delta` seconds (keyboard nudging), within the limits. */
export function nudgeRange(
  range: TimeRange,
  edge: RangeEdge,
  delta: number,
  limits: RangeLimits,
): TimeRange {
  return clampRange({ ...range, [edge]: range[edge] + delta }, limits, edge);
}

/** The range a tool starts with: the whole video, or the first `maxLength` seconds. */
export function initialRange(limits: RangeLimits): TimeRange {
  return clampRange(
    { start: 0, end: Math.min(limits.duration, limits.maxLength ?? Infinity) },
    limits,
    'end',
  );
}

/** Time under a pointer at `x` pixels across a track `width` pixels wide. */
export function timeAt(x: number, width: number, duration: number): number {
  if (width <= 0 || duration <= 0) return 0;
  return round(clamp(x / width, 0, 1) * duration);
}

/**
 * "0:05.3", "1:02.0", "1:02:03.5": tenths of a second, for trim points. With
 * `decimals = 2`, hundredths ("0:01.04"), so stepping frame by frame shows a change.
 */
export function formatClock(seconds: number, decimals: 1 | 2 = 1): string {
  const unit = decimals === 2 ? 100 : 10;
  const ticks = Math.round(Math.max(0, seconds) * unit);
  const h = Math.floor(ticks / (3600 * unit));
  const m = Math.floor((ticks % (3600 * unit)) / (60 * unit));
  const s = Math.floor((ticks % (60 * unit)) / unit);
  const fraction = String(ticks % unit).padStart(decimals, '0');
  const ss = `${String(s).padStart(2, '0')}.${fraction}`;
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
}

/** Reads what a person typed: "5", "5.3", "1:02", "1:02.5", "0:01:02.5". Null if not a time. */
export function parseClock(text: string): number | null {
  const parts = text.trim().replace(',', '.').split(':');
  if (parts.length === 0 || parts.length > 3) return null;
  if (parts.some((part) => !/^\d+(\.\d+)?$/.test(part))) return null;
  // Only the last part may have a fraction, and minutes/seconds after the first are < 60.
  const numbers = parts.map(Number);
  if (parts.slice(0, -1).some((part) => part.includes('.'))) return null;
  if (numbers.slice(1).some((n) => n >= 60)) return null;
  const seconds = numbers.reduce((total, n) => total * 60 + n, 0);
  return round(seconds);
}
