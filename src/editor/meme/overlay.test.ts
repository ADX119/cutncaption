import { describe, expect, it } from 'vitest';
import type { Measure } from '../render';
import { type OverlayCanvas, planOverlay } from './overlay';

const measure: Measure = (text, font) => text.length * Number(/([\d.]+)px/.exec(font)?.[1]) * 0.55;
const VIDEO = { width: 1280, height: 720 };

/** Records fills and text calls as compact strings. */
function recorder() {
  const calls: string[] = [];
  const state = {
    font: '',
    fillStyle: '' as OverlayCanvas['fillStyle'],
    strokeStyle: '' as OverlayCanvas['strokeStyle'],
    lineWidth: 1,
    lineJoin: 'miter' as CanvasLineJoin,
    miterLimit: 10,
    textAlign: 'start' as CanvasTextAlign,
    textBaseline: 'alphabetic' as CanvasTextBaseline,
  };
  const canvas: OverlayCanvas = Object.assign(state, {
    save: () => undefined,
    restore: () => undefined,
    measureText: (text: string) => ({ width: measure(text, state.font) }) as TextMetrics,
    fillText: (text: string, _x: number, y: number) => calls.push(`text ${text} @${Math.round(y)}`),
    strokeText: () => undefined,
    fillRect: (x: number, y: number, w: number, h: number) =>
      calls.push(`rect ${String(state.fillStyle)} ${x},${y},${w},${h}`),
  });
  return { canvas, calls };
}

describe('planOverlay', () => {
  it('top and bottom: text over the video, in capitals, top above bottom', () => {
    const plan = planOverlay(
      { layout: 'top-bottom', video: VIDEO, text: { top: 'me', bottom: 'also me' }, textScale: 1 },
      measure,
    );
    expect(plan.frame).toEqual(VIDEO);
    expect(plan.video).toEqual({ x: 0, y: 0, ...VIDEO });

    const { canvas, calls } = recorder();
    plan.draw(canvas);
    expect(calls).toHaveLength(2);
    const [top, bottom] = calls.map((call) => Number(call.split('@')[1]));
    expect(calls[0]).toMatch(/^text ME @/);
    expect(calls[1]).toMatch(/^text ALSO ME @/);
    expect(top).toBeLessThan(VIDEO.height * 0.3);
    expect(bottom).toBeGreaterThan(VIDEO.height * 0.7);
  });

  it('top and bottom: skips an empty box', () => {
    const plan = planOverlay(
      { layout: 'top-bottom', video: VIDEO, text: { top: '', bottom: 'only me' }, textScale: 1 },
      measure,
    );
    const { canvas, calls } = recorder();
    plan.draw(canvas);
    expect(calls).toEqual([expect.stringMatching(/^text ONLY ME @/)]);
  });

  it('caption bar: a white bar above the video with the caption as typed', () => {
    const plan = planOverlay(
      {
        layout: 'caption-bar',
        video: VIDEO,
        text: { top: 'me irl', bottom: 'ignored' },
        textScale: 1,
      },
      measure,
    );
    expect(plan.frame.height).toBeGreaterThan(VIDEO.height);
    const bar = plan.frame.height - VIDEO.height;
    expect(plan.video).toEqual({ x: 0, y: bar, ...VIDEO });

    const { canvas, calls } = recorder();
    plan.draw(canvas);
    expect(calls[0]).toBe(`rect #ffffff 0,0,1280,${bar}`);
    expect(calls.slice(1)).toEqual([expect.stringMatching(/^text me irl @/)]);
    expect(Number(calls[1]?.split('@')[1])).toBeLessThan(bar);
  });

  it('freeze-frame zoom: the caption sits in the bottom box', () => {
    const plan = planOverlay(
      {
        layout: 'freeze-zoom',
        video: VIDEO,
        text: { top: 'wait for it', bottom: 'ignored' },
        textScale: 1,
      },
      measure,
    );
    expect(plan.frame).toEqual(VIDEO);
    const { canvas, calls } = recorder();
    plan.draw(canvas);
    expect(calls).toEqual([expect.stringMatching(/^text WAIT FOR IT @/)]);
    expect(Number(calls[0]?.split('@')[1])).toBeGreaterThan(VIDEO.height * 0.7);
  });

  it('follows the text size', () => {
    const fonts: string[] = [];
    const sizeOf = (textScale: number) => {
      const spy: Measure = (text, font) => {
        fonts.push(font);
        return measure(text, font);
      };
      fonts.length = 0;
      planOverlay(
        { layout: 'top-bottom', video: VIDEO, text: { top: 'a', bottom: '' }, textScale },
        spy,
      );
      return Number(/([\d.]+)px/.exec(fonts[0] ?? '')?.[1]);
    };
    expect(sizeOf(1.5) / sizeOf(1)).toBeCloseTo(1.5, 6);
  });
});
