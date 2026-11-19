import { describe, expect, it } from 'vitest';
import { clampRange, formatClock, initialRange, nudgeRange, parseClock, timeAt } from './range';

const video = { duration: 10 };

describe('clampRange', () => {
  it('leaves a valid range alone', () => {
    expect(clampRange({ start: 2, end: 5 }, video, 'start')).toEqual({ start: 2, end: 5 });
  });

  it('keeps the start inside the video and before the end', () => {
    expect(clampRange({ start: -3, end: 5 }, video, 'start')).toEqual({ start: 0, end: 5 });
    expect(clampRange({ start: 9, end: 5 }, video, 'start')).toEqual({ start: 4.9, end: 5 });
  });

  it('keeps the end inside the video and after the start', () => {
    expect(clampRange({ start: 2, end: 30 }, video, 'end')).toEqual({ start: 2, end: 10 });
    expect(clampRange({ start: 2, end: 1 }, video, 'end')).toEqual({ start: 2, end: 2.1 });
  });

  it('enforces a minimum and maximum length (Meme Studio: 2–15 s)', () => {
    const meme = { duration: 60, minLength: 2, maxLength: 15 };
    expect(clampRange({ start: 10, end: 11 }, meme, 'end')).toEqual({ start: 10, end: 12 });
    expect(clampRange({ start: 10, end: 40 }, meme, 'end')).toEqual({ start: 10, end: 25 });
    expect(clampRange({ start: 1, end: 30 }, meme, 'start')).toEqual({ start: 15, end: 30 });
  });

  it('copes with a video shorter than the minimum length', () => {
    expect(clampRange({ start: 0, end: 1 }, { duration: 1, minLength: 2 }, 'end')).toEqual({
      start: 0,
      end: 1,
    });
  });

  it('rounds to milliseconds', () => {
    expect(clampRange({ start: 1.23456, end: 5 }, video, 'start').start).toBe(1.235);
  });
});

describe('nudgeRange', () => {
  it('moves one edge by a step', () => {
    expect(nudgeRange({ start: 2, end: 5 }, 'start', 0.1, video)).toEqual({ start: 2.1, end: 5 });
    expect(nudgeRange({ start: 2, end: 5 }, 'end', -1, video)).toEqual({ start: 2, end: 4 });
  });

  it('stops at the limits', () => {
    expect(nudgeRange({ start: 0, end: 5 }, 'start', -1, video)).toEqual({ start: 0, end: 5 });
    expect(nudgeRange({ start: 4.95, end: 5 }, 'start', 1, video).start).toBe(4.9);
  });
});

describe('initialRange', () => {
  it('selects the whole video, or the first maxLength seconds', () => {
    expect(initialRange(video)).toEqual({ start: 0, end: 10 });
    expect(initialRange({ duration: 60, maxLength: 15, minLength: 2 })).toEqual({
      start: 0,
      end: 15,
    });
  });
});

describe('timeAt', () => {
  it('maps a pointer position to a time', () => {
    expect(timeAt(50, 200, 10)).toBe(2.5);
    expect(timeAt(-20, 200, 10)).toBe(0);
    expect(timeAt(400, 200, 10)).toBe(10);
    expect(timeAt(10, 0, 10)).toBe(0);
  });
});

describe('formatClock', () => {
  it.each([
    [0, '0:00.0'],
    [5.34, '0:05.3'],
    [62, '1:02.0'],
    [599.96, '10:00.0'],
    [3723.5, '1:02:03.5'],
    [-1, '0:00.0'],
  ])('%d -> %s', (seconds, expected) => {
    expect(formatClock(seconds)).toBe(expected);
  });

  it.each([
    [0, '0:00.00'],
    [1.04, '0:01.04'],
    [1.034, '0:01.03'],
    [59.996, '1:00.00'],
    [3723.05, '1:02:03.05'],
  ])('%d -> %s with hundredths', (seconds, expected) => {
    expect(formatClock(seconds, 2)).toBe(expected);
  });
});

describe('parseClock', () => {
  it.each([
    ['5', 5],
    ['5.3', 5.3],
    ['5,3', 5.3],
    ['1:02', 62],
    ['1:02.5', 62.5],
    [' 0:01:02.5 ', 62.5],
  ])('"%s" -> %d', (text, expected) => {
    expect(parseClock(text)).toBe(expected);
  });

  it.each(['', 'abc', '1:60', '1.5:20', '1:2:3:4', '-5', '1::2'])('rejects "%s"', (text) => {
    expect(parseClock(text)).toBeNull();
  });

  it('round-trips what formatClock produces', () => {
    for (const seconds of [0, 5.3, 62, 3723.5]) {
      expect(parseClock(formatClock(seconds))).toBe(seconds);
    }
  });
});
