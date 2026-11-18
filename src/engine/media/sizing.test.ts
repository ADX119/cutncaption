import { describe, expect, it } from 'vitest';
import { even, scaleToShortSide } from './sizing';

describe('even', () => {
  it.each([
    [720, 720],
    [721, 722],
    [719.4, 720],
    [1, 2],
    [0, 2],
  ])('%d -> %d', (value, expected) => {
    expect(even(value)).toBe(expected);
  });
});

describe('scaleToShortSide', () => {
  it.each([
    ['1080p landscape to 720', { width: 1920, height: 1080 }, 720, { width: 1280, height: 720 }],
    ['4K landscape to 1080', { width: 3840, height: 2160 }, 1080, { width: 1920, height: 1080 }],
    [
      'portrait phone video stays portrait',
      { width: 1080, height: 1920 },
      720,
      { width: 720, height: 1280 },
    ],
    ['square', { width: 1440, height: 1440 }, 480, { width: 480, height: 480 }],
    [
      'already small: never upscaled',
      { width: 640, height: 360 },
      720,
      { width: 640, height: 360 },
    ],
    ['odd input size made even', { width: 853, height: 479 }, 1080, { width: 854, height: 480 }],
    ['odd result made even', { width: 1920, height: 1080 }, 481, { width: 856, height: 482 }],
    ['ultrawide', { width: 2560, height: 1080 }, 720, { width: 1706, height: 720 }],
  ])('%s', (_name, display, cap, expected) => {
    expect(scaleToShortSide(display, cap)).toEqual(expected);
  });

  it('keeps the aspect ratio within a pixel of rounding', () => {
    const { width, height } = scaleToShortSide({ width: 1920, height: 1080 }, 480);
    expect(Math.abs(width / height - 16 / 9)).toBeLessThan(0.01);
  });

  it('survives a zero-sized input', () => {
    expect(scaleToShortSide({ width: 0, height: 0 }, 720)).toEqual({ width: 2, height: 2 });
  });
});
