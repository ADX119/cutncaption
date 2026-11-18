import type { MediaInfo } from './probe/parse';

export interface FrameSize {
  readonly width: number;
  readonly height: number;
}

/** Nearest even number, at least 2. H.264 with yuv420p needs even dimensions. */
export function even(value: number): number {
  return Math.max(2, Math.round(value / 2) * 2);
}

/**
 * Output size for an encode that caps the short side at `maxShortSide`.
 *
 * Works on the size as displayed (ffmpeg rotates phone video upright before scaling,
 * so a portrait clip stays portrait), keeps the aspect ratio, never upscales, and
 * returns even dimensions.
 */
export function scaleToShortSide(display: FrameSize, maxShortSide: number): FrameSize {
  const short = Math.min(display.width, display.height);
  if (short <= 0) return { width: even(display.width), height: even(display.height) };
  const factor = Math.min(1, maxShortSide / short);
  return { width: even(display.width * factor), height: even(display.height * factor) };
}

/** The displayed size of a file's video, or null for audio-only files. */
export function displaySize(info: MediaInfo): FrameSize | null {
  return info.video ? { width: info.video.displayWidth, height: info.video.displayHeight } : null;
}

/** Frames per second an encode will write (ffmpeg's -fpsmax 30 caps it). */
export function outputFps(info: MediaInfo): number {
  return Math.min(info.video?.fps ?? 30, 30);
}
