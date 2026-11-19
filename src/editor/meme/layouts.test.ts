import { describe, expect, it } from 'vitest';
import type { Measure } from '../render';
import {
  BAR_STYLE,
  FREEZE_ZOOM,
  MEME_STYLE,
  type Rect,
  type Size,
  captionBarGeometry,
  clampHold,
  clampTextScale,
  freezeZoomGeometry,
  topBottomGeometry,
  zoomScale,
  zoomWindow,
} from './layouts';

/** Every character is 0.55 of the font size wide. */
const measure: Measure = (text, font) => text.length * Number(/([\d.]+)px/.exec(font)?.[1]) * 0.55;

const SHAPES: readonly [string, Size][] = [
  ['landscape 16:9', { width: 1280, height: 720 }],
  ['portrait 9:16', { width: 720, height: 1280 }],
  ['square', { width: 720, height: 720 }],
  ['ultra-wide 2.4:1', { width: 1920, height: 800 }],
  ['small 4:3', { width: 320, height: 240 }],
];

const inside = (inner: Rect, outer: Size) =>
  inner.x >= 0 &&
  inner.y >= 0 &&
  inner.x + inner.width <= outer.width + 1e-9 &&
  inner.y + inner.height <= outer.height + 1e-9;

describe('clampTextScale', () => {
  it('keeps the size control between half and 1.6 times the default', () => {
    expect(clampTextScale(1)).toBe(1);
    expect(clampTextScale(0.1)).toBe(0.5);
    expect(clampTextScale(3)).toBe(1.6);
    expect(clampTextScale(Number.NaN)).toBe(1);
  });
});

describe.each(SHAPES)('top and bottom text, %s', (_, video) => {
  const geometry = topBottomGeometry(video);

  it('keeps the video frame as it is', () => {
    expect(geometry.frame).toEqual(video);
  });

  it('puts the boxes at the top and bottom, inside the frame, apart', () => {
    const { top, bottom } = geometry.boxes;
    expect(inside(top, video)).toBe(true);
    expect(inside(bottom, video)).toBe(true);
    expect(top.y + top.height).toBeLessThan(bottom.y);
    expect(top.y).toBeCloseTo(video.height - (bottom.y + bottom.height), 9);
    expect(top.height).toBeCloseTo(video.height * 0.28, 9);
  });

  it('sizes text from the frame: 13% of the height, but never more than 11% of the width', () => {
    const expected = Math.min(video.height * 0.13, video.width * 0.11);
    expect(geometry.fit.maxSize).toBeCloseTo(expected, 9);
    expect(geometry.fit.minSize).toBeCloseTo(expected * 0.35, 9);
  });

  it('anchors top text to the top and bottom text to the bottom', () => {
    expect(geometry.styles.top.verticalAlign).toBe('top');
    expect(geometry.styles.bottom.verticalAlign).toBe('bottom');
    expect(geometry.styles.top.family).toBe(MEME_STYLE.family);
  });
});

describe('top and bottom text', () => {
  it('scales with the frame, so the preview and the export agree', () => {
    const small = topBottomGeometry({ width: 640, height: 360 });
    const big = topBottomGeometry({ width: 1920, height: 1080 });
    expect(big.boxes.top.height / small.boxes.top.height).toBeCloseTo(3, 9);
    expect(big.boxes.bottom.y / small.boxes.bottom.y).toBeCloseTo(3, 9);
    expect(big.fit.maxSize / small.fit.maxSize).toBeCloseTo(3, 9);
  });

  it('follows the size control', () => {
    const normal = topBottomGeometry({ width: 1280, height: 720 });
    const large = topBottomGeometry({ width: 1280, height: 720 }, 1.5);
    expect(large.fit.maxSize).toBeCloseTo(normal.fit.maxSize * 1.5, 9);
  });
});

describe.each(SHAPES)('caption bar, %s', (_, video) => {
  const short = captionBarGeometry(video, 'me irl', 1, measure);
  const long = captionBarGeometry(
    video,
    'when you finally understand the assignment but the deadline was yesterday and nobody told you',
    1,
    measure,
  );

  it('adds an even-height bar above the video', () => {
    for (const geometry of [short, long]) {
      expect(geometry.bar % 2).toBe(0);
      expect(geometry.frame).toEqual({ width: video.width, height: video.height + geometry.bar });
      expect(geometry.video).toEqual({ x: 0, y: geometry.bar, ...video });
    }
  });

  it('grows the bar for more lines, up to half the video height', () => {
    expect(long.bar).toBeGreaterThan(short.bar);
    expect(long.bar).toBeLessThanOrEqual(Math.ceil(video.height / 2 / 2) * 2);
  });

  it('keeps the text inside the bar', () => {
    for (const geometry of [short, long]) {
      expect(inside(geometry.box, { width: video.width, height: geometry.bar })).toBe(true);
      expect(geometry.layout.top + geometry.layout.height).toBeLessThanOrEqual(
        geometry.box.y + geometry.box.height + 1e-6,
      );
    }
  });

  it('sets black text centred on white', () => {
    expect(short.style).toBe(BAR_STYLE);
    expect(short.style.align).toBe('center');
  });
});

describe('caption bar', () => {
  it('keeps a one-line bar while the caption is empty, so the frame does not jump', () => {
    const video = { width: 1280, height: 720 };
    expect(captionBarGeometry(video, '', 1, measure).bar).toBe(
      captionBarGeometry(video, 'ok', 1, measure).bar,
    );
  });

  it('shrinks text that would need a bar taller than half the video', () => {
    const video = { width: 640, height: 360 };
    const essay = 'word '.repeat(200);
    const geometry = captionBarGeometry(video, essay, 1, measure);
    expect(geometry.bar).toBe(180);
    expect(geometry.layout.size).toBeLessThan(640 * 0.05);
  });

  it('scales with the frame, within a pixel of rounding', () => {
    const text = 'nobody: absolutely nobody: me';
    const small = captionBarGeometry({ width: 640, height: 360 }, text, 1, measure);
    const big = captionBarGeometry({ width: 1920, height: 1080 }, text, 1, measure);
    expect(Math.abs(big.bar - small.bar * 3)).toBeLessThanOrEqual(6);
    expect(big.layout.size / small.layout.size).toBeCloseTo(3, 6);
  });
});

describe('freeze-frame zoom', () => {
  it('eases from no zoom to the full zoom, slowly at both ends', () => {
    expect(zoomScale(0)).toBe(1);
    expect(zoomScale(1)).toBeCloseTo(FREEZE_ZOOM.maxZoom, 9);
    expect(zoomScale(0.5)).toBeCloseTo((1 + FREEZE_ZOOM.maxZoom) / 2, 9);
    expect(zoomScale(0.02) - 1).toBeLessThan(0.002);
    expect(zoomScale(-1)).toBe(1);
    expect(zoomScale(2)).toBeCloseTo(FREEZE_ZOOM.maxZoom, 9);
    for (let p = 0; p < 1; p += 0.05) expect(zoomScale(p + 0.05)).toBeGreaterThan(zoomScale(p));
  });

  it.each(SHAPES)('shows the whole %s frame before zooming', (_, video) => {
    expect(zoomWindow(video, { x: 0.3, y: 0.7 }, 1)).toEqual({ x: 0, y: 0, ...video });
  });

  it('zooms toward the chosen point', () => {
    const window = zoomWindow({ width: 1280, height: 720 }, { x: 0.5, y: 0.5 }, 2);
    expect(window).toEqual({ x: 320, y: 180, width: 640, height: 360 });
  });

  it.each(SHAPES)('keeps the %s window inside the frame near the edges', (_, video) => {
    for (const focal of [
      { x: 0, y: 0 },
      { x: 1, y: 1 },
      { x: 0.02, y: 0.98 },
    ]) {
      const window = zoomWindow(video, focal, FREEZE_ZOOM.maxZoom);
      expect(inside(window, video)).toBe(true);
      expect(window.width).toBeCloseTo(video.width / FREEZE_ZOOM.maxZoom, 9);
      expect(window.height).toBeCloseTo(video.height / FREEZE_ZOOM.maxZoom, 9);
    }
  });

  it('holds the freeze for 1 to 3 seconds', () => {
    expect(clampHold(2)).toBe(2);
    expect(clampHold(0.2)).toBe(FREEZE_ZOOM.minHold);
    expect(clampHold(9)).toBe(FREEZE_ZOOM.maxHold);
    expect(clampHold(Number.NaN)).toBe(FREEZE_ZOOM.defaultHold);
  });

  it.each(SHAPES)('puts the %s caption in the bottom box', (_, video) => {
    const geometry = freezeZoomGeometry(video);
    expect(geometry.frame).toEqual(video);
    expect(geometry.box).toEqual(topBottomGeometry(video).boxes.bottom);
    expect(geometry.style.verticalAlign).toBe('bottom');
  });
});
