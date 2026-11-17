/**
 * Progress comes from the "time=" field of ffmpeg's status lines:
 *   frame=  120 fps= 40 q=28.0 size=  256kB time=00:00:04.00 bitrate= 524.3kbits/s speed=1.33x
 * ffmpeg.wasm's own progress event is unreliable with filter graphs, so it is not used.
 */

/** Seconds of output written so far, or null if the line has no usable time. */
export function parseStatusTime(line: string): number | null {
  const match = /\btime=\s*(-?)(\d+):(\d{2}):(\d{2}(?:\.\d+)?)/.exec(line);
  if (!match || match[1] === '-') return null;
  return Number(match[2]) * 3600 + Number(match[3]) * 60 + Number(match[4]);
}

/**
 * Turns status lines into a fraction from 0 to 1 that never goes backwards.
 * `expectedSec` is the duration of the output the job will produce.
 * Returns the new fraction when it moved forward, otherwise null.
 */
export function createProgressTracker(expectedSec: number): (line: string) => number | null {
  let last = 0;
  return (line) => {
    if (!(expectedSec > 0)) return null;
    const seconds = parseStatusTime(line);
    if (seconds === null) return null;
    // Stop short of 1: the job is only done when ffmpeg has exited and the file is read.
    const fraction = Math.min(0.99, seconds / expectedSec);
    if (fraction <= last) return null;
    last = fraction;
    return fraction;
  };
}
