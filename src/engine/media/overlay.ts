import {
  type OverlayCanvas,
  type OverlaySpec,
  type Rect,
  type Size,
  planOverlay,
} from '@/editor/meme';
import { canvasMeasure } from '@/editor/render';
import { EngineError } from '../errors';
import { fonts } from '../fonts';

/** A drawing surface and a way to save it as PNG. */
export interface OverlaySurface {
  readonly context: OverlayCanvas | null;
  toPng(): Promise<Blob>;
}

export interface OverlayDeps {
  readonly loadFonts: () => Promise<unknown>;
  readonly createCanvas: (width: number, height: number) => OverlaySurface;
}

export interface RenderedOverlay {
  /** Transparent PNG of the caption layer (and bar), exactly `frame` in size. */
  readonly blob: Blob;
  readonly frame: Size;
  /** Where the video goes inside the frame. */
  readonly video: Rect;
}

/**
 * OffscreenCanvas where the browser has it, otherwise a detached <canvas>. Both run on
 * the page's thread, so both draw with the fonts registered in document.fonts.
 */
function browserCanvas(width: number, height: number): OverlaySurface {
  if (typeof OffscreenCanvas !== 'undefined') {
    const canvas = new OffscreenCanvas(width, height);
    return {
      context: canvas.getContext('2d'),
      toPng: () => canvas.convertToBlob({ type: 'image/png' }),
    };
  }
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return {
    context: canvas.getContext('2d'),
    toPng: () =>
      new Promise((resolve, reject) =>
        canvas.toBlob(
          (blob) => (blob ? resolve(blob) : reject(new Error('canvas.toBlob gave nothing'))),
          'image/png',
        ),
      ),
  };
}

const BROWSER: OverlayDeps = {
  loadFonts: () => fonts().loadAll(),
  createCanvas: browserCanvas,
};

/**
 * Draws a meme's caption layer at output size with the same planOverlay the preview
 * uses, and saves it as a transparent PNG for ffmpeg to lay over the video (`ov.png`).
 * Text is never drawn by ffmpeg (ARCHITECTURE §7).
 */
export async function renderOverlay(
  spec: OverlaySpec,
  deps: OverlayDeps = BROWSER,
): Promise<RenderedOverlay> {
  // Measuring before the fonts arrive would lay the text out for a fallback font.
  await deps.loadFonts();

  const measuring = deps.createCanvas(1, 1).context;
  if (!measuring) throw new EngineError('job-failed', 'no 2D canvas to measure text');
  const plan = planOverlay(spec, canvasMeasure(measuring));

  const surface = deps.createCanvas(plan.frame.width, plan.frame.height);
  if (!surface.context) throw new EngineError('job-failed', 'no 2D canvas to draw the caption');
  plan.draw(surface.context);
  try {
    return { blob: await surface.toPng(), frame: plan.frame, video: plan.video };
  } catch (error) {
    throw new EngineError('job-failed', `caption image: ${String(error)}`, { cause: error });
  }
}
