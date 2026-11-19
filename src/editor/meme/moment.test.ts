import { describe, expect, it } from 'vitest';
import { MOMENT, frameDuration, initialMoment, momentLimits, stepFrame } from './moment';

describe('momentLimits', () => {
  it('allows 2 to 15 seconds', () => {
    expect(momentLimits(60)).toEqual({ duration: 60, minLength: 2, maxLength: 15 });
    expect(MOMENT).toMatchObject({ minLength: 2, maxLength: 15 });
  });

  it('treats an unknown or empty duration as zero', () => {
    expect(momentLimits(Number.NaN).duration).toBe(0);
    expect(momentLimits(-3).duration).toBe(0);
  });
});

describe('initialMoment', () => {
  it('starts with the first 5 seconds', () => {
    expect(initialMoment(60)).toEqual({ start: 0, end: 5 });
  });

  it('takes the whole video when it is shorter than that', () => {
    expect(initialMoment(3.2)).toEqual({ start: 0, end: 3.2 });
    // Shorter than the 2 s minimum: the whole clip is the moment.
    expect(initialMoment(1.5)).toEqual({ start: 0, end: 1.5 });
  });
});

describe('frameDuration', () => {
  it('is one frame at the video frame rate', () => {
    expect(frameDuration(25)).toBe(0.04);
    expect(frameDuration(30)).toBeCloseTo(1 / 30, 12);
  });

  it('assumes 30 fps when the rate is unknown or nonsense', () => {
    for (const fps of [null, 0, -5, Number.NaN, 2000])
      expect(frameDuration(fps)).toBeCloseTo(1 / 30, 12);
  });
});

describe('stepFrame', () => {
  it('moves to the next and previous frame on the frame grid', () => {
    expect(stepFrame(1, 1, 25, 10)).toBe(1.04);
    expect(stepFrame(1, -1, 25, 10)).toBe(0.96);
  });

  it('snaps a time between frames to the neighbouring frame', () => {
    // 1.013 s is inside frame 25 (1.00–1.04) at 25 fps.
    expect(stepFrame(1.013, 1, 25, 10)).toBe(1.04);
    expect(stepFrame(1.013, -1, 25, 10)).toBe(0.96);
  });

  it('lands inside the frame, so the browser shows that frame and not the one before', () => {
    // Frame 1 at 30 fps starts at 0.0333…; a millisecond-rounded time must not fall short.
    const time = stepFrame(0, 1, 30, 10);
    expect(time).toBeGreaterThanOrEqual(1 / 30);
    expect(time).toBeLessThan(2 / 30);
    expect(stepFrame(time, 1, 30, 10)).toBeGreaterThanOrEqual(2 / 30);
  });

  it('stays within the video', () => {
    expect(stepFrame(0, -1, 25, 10)).toBe(0);
    expect(stepFrame(9.99, 1, 25, 10)).toBe(10);
  });
});
