'use client';

import { useEffect, useRef, useState } from 'react';
import {
  BAR_COLOR,
  type Rect,
  type Size,
  captionBarGeometry,
  topBottomGeometry,
} from '@/editor/meme';
import { canvasMeasure, drawText, layoutText } from '@/editor/render';
import { fonts } from '@/engine/fonts';
import { t } from '@/i18n';

const LANDSCAPE: Size = { width: 640, height: 360 };
const PORTRAIT: Size = { width: 360, height: 640 };

/**
 * A stand-in video frame: dark on the left, light on the right, so outlines are judged
 * on both. Its colours are part of the drawn picture, not of the interface.
 */
function drawFrame(context: CanvasRenderingContext2D, rect: Rect) {
  context.fillStyle = 'dimgray';
  context.fillRect(rect.x, rect.y, rect.width, rect.height);
  context.fillStyle = 'gainsboro';
  context.fillRect(rect.x + rect.width / 2, rect.y, rect.width / 2, rect.height);
}

function resize(canvas: HTMLCanvasElement, size: Size) {
  canvas.width = size.width;
  canvas.height = size.height;
}

interface Sample {
  readonly id: string;
  readonly label: string;
  draw(canvas: HTMLCanvasElement, context: CanvasRenderingContext2D): void;
}

function topAndBottom(
  canvas: HTMLCanvasElement,
  context: CanvasRenderingContext2D,
  video: Size,
  top: string,
  bottom: string,
) {
  const { frame, boxes, styles, fit } = topBottomGeometry(video);
  resize(canvas, frame);
  const measure = canvasMeasure(context);
  drawFrame(context, { x: 0, y: 0, ...frame });
  drawText(context, layoutText(top, boxes.top, styles.top, fit, measure), styles.top);
  drawText(context, layoutText(bottom, boxes.bottom, styles.bottom, fit, measure), styles.bottom);
}

const SAMPLES: readonly Sample[] = [
  {
    id: 'latin',
    label: t('textPreview.latin.label'),
    draw: (canvas, context) =>
      topAndBottom(
        canvas,
        context,
        LANDSCAPE,
        t('textPreview.latin.top'),
        t('textPreview.latin.bottom'),
      ),
  },
  {
    id: 'hindi',
    label: t('textPreview.hindi.label'),
    draw: (canvas, context) =>
      topAndBottom(
        canvas,
        context,
        LANDSCAPE,
        t('textPreview.hindi.top'),
        t('textPreview.hindi.bottom'),
      ),
  },
  {
    id: 'bar',
    label: t('textPreview.bar.label'),
    draw: (canvas, context) => {
      const geometry = captionBarGeometry(
        LANDSCAPE,
        t('textPreview.bar.text'),
        1,
        canvasMeasure(context),
      );
      resize(canvas, geometry.frame);
      context.fillStyle = BAR_COLOR;
      context.fillRect(0, 0, geometry.frame.width, geometry.bar);
      drawFrame(context, geometry.video);
      drawText(context, geometry.layout, geometry.style);
    },
  },
  {
    id: 'fit',
    label: t('textPreview.fit.label'),
    draw: (canvas, context) =>
      topAndBottom(canvas, context, LANDSCAPE, t('textPreview.fit.text'), ''),
  },
  {
    id: 'portrait',
    label: t('textPreview.portrait.label'),
    draw: (canvas, context) =>
      topAndBottom(
        canvas,
        context,
        PORTRAIT,
        t('textPreview.latin.top'),
        t('textPreview.latin.bottom'),
      ),
  },
];

function SampleCanvas({ sample, ready }: { sample: Sample; ready: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    const context = canvas?.getContext('2d');
    if (!ready || !canvas || !context) return;
    sample.draw(canvas, context);
    // Browser tests wait for this before taking screenshots.
    canvas.dataset.drawn = 'true';
  }, [ready, sample]);

  return (
    <figure>
      {/* Shown at its own pixel size, narrower on small screens. */}
      <canvas
        ref={ref}
        width={LANDSCAPE.width}
        height={LANDSCAPE.height}
        data-testid={`text-sample-${sample.id}`}
        className="border-rule h-auto max-w-full rounded-lg border"
      />
      <figcaption className="text-graphite mt-2 text-sm">{sample.label}</figcaption>
    </figure>
  );
}

/**
 * The meme layouts (editor/meme) drawn by the caption renderer with the studio fonts,
 * in Latin and Devanagari, for design review and screenshot tests. Not a tool; unlisted
 * and kept out of search.
 */
export function TextPreview() {
  const [status, setStatus] = useState<'loading' | 'ready' | 'failed'>('loading');

  useEffect(() => {
    fonts()
      .loadAll()
      .then(() => setStatus('ready'))
      .catch(() => setStatus('failed'));
  }, []);

  return (
    <div className="grid gap-10">
      {status === 'loading' ? <p className="text-graphite">{t('textPreview.loading')}</p> : null}
      {status === 'failed' ? (
        <p className="text-danger">{t('error.asset-download-failed')}</p>
      ) : null}
      {SAMPLES.map((sample) => (
        <SampleCanvas key={sample.id} sample={sample} ready={status === 'ready'} />
      ))}
    </div>
  );
}
