import { describe, expect, it } from 'vitest';
import { formatDuration } from './formatDuration';

describe('formatDuration', () => {
  it.each([
    [0, '0:00'],
    [5, '0:05'],
    [59.6, '1:00'],
    [62.4, '1:02'],
    [600, '10:00'],
    [3723, '1:02:03'],
    [null, '–'],
    [undefined, '–'],
    [Number.NaN, '–'],
    [-3, '–'],
  ])('%s -> %s', (seconds, expected) => {
    expect(formatDuration(seconds)).toBe(expected);
  });
});
