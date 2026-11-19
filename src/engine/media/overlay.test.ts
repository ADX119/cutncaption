import { describe, expect, it, vi } from 'vitest';
import type { OverlayCanvas } from '@/editor/meme';
import { EngineError } from '../errors';
import { type OverlaySurface, renderOverlay } from './overlay';

/** A canvas double: measures every character as 0.55 of the font size, records size and draws. */
function fakeSurfaces() {
  const created: { width: number; height: number; draws: string[] }[] = [];
  const createCanvas = vi.fn((width: number, height: number): OverlaySurface => {
    const record = { width, height, draws: [] as string[] };
    created.push(record);
    const state = { font: '' };
    const context = Object.assign(state, {
      fillStyle: '',
      strokeStyle: '',
      lineWidth: 1,
      lineJoin: 'miter',
      miterLimit: 10,
      textAlign: 'start',
      textBaseline: 'alphabetic',
      save: () => undefined,
      restore: () => undefined,
      measureText: (text: string) => ({
        width: text.length * Number(/([\d.]+)px/.exec(state.font)?.[1]) * 0.55,
      }),
      fillText: (text: string) => record.draws.push(`fill ${text}`),
      strokeText: () => undefined,
      fillRect: () => record.draws.push('rect'),
    }) as unknown as OverlayCanvas;
    return {
      context,
      toPng: async () => new Blob([new Uint8Array([137, 80])], { type: 'image/png' }),
    };
  });
  return { created, createCanvas };
}

const SPEC = {
  layout: 'top-bottom' as const,
  video: { width: 1280, height: 720 },
  text: { top: 'top', bottom: 'bottom' },
  textScale: 1,
};

describe('renderOverlay', () => {
  it('loads the fonts before measuring, then draws on a canvas the size of the frame', async () => {
    const order: string[] = [];
    const { created, createCanvas } = fakeSurfaces();
    const loadFonts = vi.fn(async () => {
      order.push('fonts');
    });
    createCanvas.mockImplementationOnce((width, height) => {
      order.push('measure canvas');
      return fakeSurfaces().createCanvas(width, height);
    });

    const result = await renderOverlay(SPEC, { loadFonts, createCanvas });

    expect(order).toEqual(['fonts', 'measure canvas']);
    expect(result.frame).toEqual({ width: 1280, height: 720 });
    expect(result.video).toEqual({ x: 0, y: 0, width: 1280, height: 720 });
    expect(result.blob.type).toBe('image/png');
    const drawn = created.at(-1);
    expect(drawn).toMatchObject({ width: 1280, height: 720 });
    expect(drawn?.draws).toEqual(['fill TOP', 'fill BOTTOM']);
  });

  it('makes the frame taller for the caption bar', async () => {
    const { created, createCanvas } = fakeSurfaces();
    const result = await renderOverlay(
      { ...SPEC, layout: 'caption-bar' },
      { loadFonts: async () => undefined, createCanvas },
    );
    expect(result.frame.height).toBeGreaterThan(720);
    expect(result.video.y).toBe(result.frame.height - 720);
    expect(created.at(-1)).toMatchObject({ width: 1280, height: result.frame.height });
    expect(created.at(-1)?.draws[0]).toBe('rect');
  });

  it('reports a browser without a 2D canvas as a failed job', async () => {
    const error = await renderOverlay(SPEC, {
      loadFonts: async () => undefined,
      createCanvas: () => ({ context: null, toPng: async () => new Blob() }),
    }).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(EngineError);
    expect((error as EngineError).code).toBe('job-failed');
  });

  it('passes a font download failure through unchanged', async () => {
    const failure = new EngineError('asset-download-failed', 'Anton');
    const { createCanvas } = fakeSurfaces();
    await expect(
      renderOverlay(SPEC, { loadFonts: () => Promise.reject(failure), createCanvas }),
    ).rejects.toBe(failure);
    expect(createCanvas).not.toHaveBeenCalled();
  });
});
