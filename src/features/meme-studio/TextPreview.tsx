'use client';

import { useEffect, useRef, useState } from 'react';
import { type Box, type TextStyle, canvasMeasure, drawText, layoutText } from '@/editor/render';
import { fonts } from '@/engine/fonts';
import { t } from '@/i18n';

const WIDTH = 640;
const HEIGHT = 360;

/*
 * Colours here belong to the drawn picture (the meme), not to the interface, so they
 * are not design tokens. The real layouts come from editor/meme (M3.3).
 */
const MEME: TextStyle = {
  family: '"Anton", "Noto Sans Devanagari"',
  weight: 400,
  color: 'white',
  outline: { color: 'black', width: 0.14 },
  align: 'center',
  verticalAlign: 'top',
  lineHeight: 1.12,
  uppercase: true,
};

const BAR: TextStyle = {
  family: '"Noto Sans", "Noto Sans Devanagari"',
  weight: 700,
  color: 'black',
  align: 'left',
  verticalAlign: 'middle',
  lineHeight: 1.3,
};

const MEME_FIT = { maxSize: HEIGHT * 0.13, minSize: HEIGHT * 0.04 };
const BAR_HEIGHT = Math.round(HEIGHT * 0.3);

const topBox: Box = {
  x: WIDTH * 0.04,
  y: HEIGHT * 0.03,
  width: WIDTH * 0.92,
  height: HEIGHT * 0.26,
};
const bottomBox: Box = { ...topBox, y: HEIGHT * 0.71 };

/** A stand-in video frame: dark on the left, light on the right, so outlines are judged on both. */
function drawFrame(context: CanvasRenderingContext2D, top = 0) {
  context.fillStyle = 'dimgray';
  context.fillRect(0, top, WIDTH, HEIGHT);
  context.fillStyle = 'gainsboro';
  context.fillRect(WIDTH / 2, top, WIDTH / 2, HEIGHT);
}

interface Sample {
  readonly id: string;
  readonly label: string;
  readonly height: number;
  draw(context: CanvasRenderingContext2D): void;
}

function topAndBottom(context: CanvasRenderingContext2D, top: string, bottom: string) {
  const measure = canvasMeasure(context);
  drawFrame(context);
  drawText(context, layoutText(top, topBox, MEME, MEME_FIT, measure), MEME);
  const bottomStyle = { ...MEME, verticalAlign: 'bottom' as const };
  drawText(context, layoutText(bottom, bottomBox, bottomStyle, MEME_FIT, measure), bottomStyle);
}

const SAMPLES: readonly Sample[] = [
  {
    id: 'latin',
    label: t('textPreview.latin.label'),
    height: HEIGHT,
    draw: (context) =>
      topAndBottom(context, t('textPreview.latin.top'), t('textPreview.latin.bottom')),
  },
  {
    id: 'hindi',
    label: t('textPreview.hindi.label'),
    height: HEIGHT,
    draw: (context) =>
      topAndBottom(context, t('textPreview.hindi.top'), t('textPreview.hindi.bottom')),
  },
  {
    id: 'bar',
    label: t('textPreview.bar.label'),
    height: HEIGHT + BAR_HEIGHT,
    draw: (context) => {
      context.fillStyle = 'white';
      context.fillRect(0, 0, WIDTH, BAR_HEIGHT);
      drawFrame(context, BAR_HEIGHT);
      const box = {
        x: WIDTH * 0.05,
        y: BAR_HEIGHT * 0.1,
        width: WIDTH * 0.9,
        height: BAR_HEIGHT * 0.8,
      };
      const fit = { maxSize: HEIGHT * 0.075, minSize: HEIGHT * 0.035 };
      drawText(
        context,
        layoutText(t('textPreview.bar.text'), box, BAR, fit, canvasMeasure(context)),
        BAR,
      );
    },
  },
  {
    id: 'fit',
    label: t('textPreview.fit.label'),
    height: HEIGHT,
    draw: (context) => {
      drawFrame(context);
      drawText(
        context,
        layoutText(t('textPreview.fit.text'), topBox, MEME, MEME_FIT, canvasMeasure(context)),
        MEME,
      );
    },
  },
];

function SampleCanvas({ sample, ready }: { sample: Sample; ready: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    const context = canvas?.getContext('2d');
    if (!ready || !canvas || !context) return;
    sample.draw(context);
    // Browser tests wait for this before taking screenshots.
    canvas.dataset.drawn = 'true';
  }, [ready, sample]);

  return (
    <figure>
      <canvas
        ref={ref}
        width={WIDTH}
        height={sample.height}
        data-testid={`text-sample-${sample.id}`}
        className="border-rule h-auto w-full max-w-[640px] rounded-lg border"
      />
      <figcaption className="text-graphite mt-2 text-sm">{sample.label}</figcaption>
    </figure>
  );
}

/**
 * The caption renderer drawing Latin and Devanagari samples with the studio fonts, for
 * design review and screenshot tests. Not a tool; unlisted and kept out of search.
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
