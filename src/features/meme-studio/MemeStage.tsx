'use client';

import { type Ref, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { type OverlaySpec, type Size, planOverlay } from '@/editor/meme';
import { type Measure, canvasMeasure } from '@/editor/render';
import type { TimeRange } from '@/editor/timeline';
import { t } from '@/i18n';

interface MemeStageProps {
  readonly file: File;
  /** The video's display size (after rotation), from the probe. */
  readonly videoSize: Size;
  readonly spec: Omit<OverlaySpec, 'video'>;
  /** Studio fonts loaded; layout waits for them so it measures the real glyphs. */
  readonly fontsReady: boolean;
  readonly videoRef: Ref<HTMLVideoElement>;
  /** Playback loops inside the moment. */
  readonly loop: TimeRange;
  readonly onTime: (seconds: number) => void;
  readonly onPlayingChange: (playing: boolean) => void;
}

/** Share of the window height the stage may use, so the controls stay in reach. */
const MAX_HEIGHT_SHARE = 0.6;

/** Width of an element, kept up to date. */
function useWidth() {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => setWidth(entry?.contentRect.width ?? 0));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return [ref, width] as const;
}

function useMaxHeight() {
  const [height, setHeight] = useState(() => window.innerHeight * MAX_HEIGHT_SHARE);
  useEffect(() => {
    const update = () => setHeight(window.innerHeight * MAX_HEIGHT_SHARE);
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);
  return height;
}

/**
 * The video with the caption layer drawn over it at the screen's pixel density, by the
 * same planOverlay the export uses. For the caption-bar layout the stage grows a white
 * bar above the video. Sits on the neutral stage colour (docs/DESIGN.md).
 */
export function MemeStage({
  file,
  videoSize,
  spec,
  fontsReady,
  videoRef,
  loop,
  onTime,
  onPlayingChange,
}: MemeStageProps) {
  const [wrapper, availableWidth] = useWidth();
  const maxHeight = useMaxHeight();
  const canvas = useRef<HTMLCanvasElement>(null);
  const [url, setUrl] = useState<string>();

  useEffect(() => {
    const objectUrl = URL.createObjectURL(file);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- syncing with an external resource
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [file]);

  // A detached canvas measures text with the same document fonts the stage draws with.
  const measure = useMemo<Measure>(() => {
    const context = document.createElement('canvas').getContext('2d');
    return context ? canvasMeasure(context) : () => 0;
  }, []);

  const { layout, text, textScale } = spec;
  const stage = useMemo(() => {
    if (availableWidth <= 0 || videoSize.width <= 0 || videoSize.height <= 0) return null;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const planAt = (cssWidth: number) => {
      const width = Math.max(2, Math.round(cssWidth * dpr));
      const height = Math.round((width * videoSize.height) / videoSize.width);
      return planOverlay({ layout, text, textScale, video: { width, height } }, measure);
    };
    // Fit the width first; if the frame is then too tall, narrow it to fit the height.
    let plan = planAt(availableWidth);
    const cssHeight = plan.frame.height / dpr;
    if (cssHeight > maxHeight) plan = planAt((availableWidth * maxHeight) / cssHeight);
    return { plan, dpr };
    // fontsReady: measurements change once the real fonts arrive.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [availableWidth, maxHeight, videoSize, layout, text, textScale, measure, fontsReady]);

  useLayoutEffect(() => {
    const context = canvas.current?.getContext('2d');
    if (!stage || !context || !fontsReady) return;
    context.clearRect(0, 0, stage.plan.frame.width, stage.plan.frame.height);
    stage.plan.draw(context);
  }, [stage, fontsReady]);

  const css = (value: number) => (stage ? value / stage.dpr : 0);

  return (
    <div ref={wrapper} className="bg-stage flex justify-center overflow-hidden rounded-lg">
      {stage && url ? (
        <div
          className="relative"
          role="img"
          aria-label={t('meme.stage')}
          style={{ width: css(stage.plan.frame.width), height: css(stage.plan.frame.height) }}
        >
          <video
            ref={videoRef}
            src={url}
            playsInline
            preload="auto"
            className="absolute object-contain"
            style={{
              left: css(stage.plan.video.x),
              top: css(stage.plan.video.y),
              width: css(stage.plan.video.width),
              height: css(stage.plan.video.height),
            }}
            onTimeUpdate={(event) => {
              const video = event.currentTarget;
              if (!video.paused && video.currentTime >= loop.end) video.currentTime = loop.start;
              onTime(video.currentTime);
            }}
            onSeeked={(event) => onTime(event.currentTarget.currentTime)}
            onPlay={(event) => {
              const video = event.currentTarget;
              if (video.currentTime < loop.start || video.currentTime >= loop.end) {
                video.currentTime = loop.start;
              }
              onPlayingChange(true);
            }}
            onPause={() => onPlayingChange(false)}
          />
          <canvas
            ref={canvas}
            width={stage.plan.frame.width}
            height={stage.plan.frame.height}
            data-testid="meme-overlay"
            className="pointer-events-none absolute inset-0 h-full w-full"
          />
        </div>
      ) : (
        <div className="aspect-video w-full" />
      )}
    </div>
  );
}
