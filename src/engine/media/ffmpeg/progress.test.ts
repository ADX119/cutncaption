import { describe, expect, it } from 'vitest';
import { createProgressTracker, parseStatusTime } from './progress';

const status = (time: string) =>
  `frame=  120 fps= 40 q=28.0 size=     256kB time=${time} bitrate= 524.3kbits/s speed=1.33x`;

describe('parseStatusTime', () => {
  it.each([
    [status('00:00:04.00'), 4],
    [status('00:01:02.50'), 62.5],
    [status('01:00:00.00'), 3600],
    ['size=N/A time=00:00:01.20 bitrate=N/A speed=0.5x', 1.2],
  ])('%s -> %d', (line, expected) => {
    expect(parseStatusTime(line)).toBeCloseTo(expected, 5);
  });

  it.each([
    'time=N/A',
    status('-00:00:00.02'),
    'Stream #0:0: Video: h264',
    'Duration: 00:00:05.00, start: 0.000000, bitrate: 155 kb/s',
  ])('ignores "%s"', (line) => {
    expect(parseStatusTime(line)).toBeNull();
  });
});

describe('createProgressTracker', () => {
  it('reports forward movement only, as a fraction of the expected length', () => {
    const track = createProgressTracker(10);
    expect(track(status('00:00:02.00'))).toBeCloseTo(0.2);
    expect(track(status('00:00:01.00'))).toBeNull();
    expect(track(status('00:00:02.00'))).toBeNull();
    expect(track('unrelated line')).toBeNull();
    expect(track(status('00:00:05.00'))).toBeCloseTo(0.5);
  });

  it('stays below 1 until the job has actually finished', () => {
    const track = createProgressTracker(10);
    expect(track(status('00:00:12.00'))).toBe(0.99);
  });

  it('reports nothing when the length is unknown', () => {
    expect(createProgressTracker(0)(status('00:00:02.00'))).toBeNull();
    expect(createProgressTracker(Number.NaN)(status('00:00:02.00'))).toBeNull();
  });
});
