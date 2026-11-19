import {
  type Measure,
  type TextCanvas,
  type TextLayout,
  type TextStyle,
  drawText,
  layoutText,
} from '../render';
import {
  BAR_COLOR,
  type MemeLayoutId,
  type Rect,
  type Size,
  captionBarGeometry,
  freezeZoomGeometry,
  topBottomGeometry,
} from './layouts';

/** What the person typed. Caption bar and freeze-frame zoom use `top` as their one caption. */
export interface MemeText {
  readonly top: string;
  readonly bottom: string;
}

export interface OverlaySpec {
  readonly layout: MemeLayoutId;
  /** The video picture size the overlay is drawn for: preview canvas or export frame. */
  readonly video: Size;
  readonly text: MemeText;
  readonly textScale: number;
}

export type OverlayCanvas = TextCanvas & Pick<CanvasRenderingContext2D, 'fillRect'>;

export interface OverlayPlan {
  /** Size of the whole picture: the video, plus the bar for the caption-bar layout. */
  readonly frame: Size;
  /** Where the video sits inside the frame. */
  readonly video: Rect;
  /** Draws the caption layer (and bar) onto a transparent context of `frame` size. */
  draw(context: OverlayCanvas): void;
}

/**
 * The caption layer of a meme: one function for the live preview and the exported
 * overlay, so what the person sees is what they get. Laid out once with `measure`
 * (which must use the same fonts the context draws with), drawn on demand.
 */
export function planOverlay(spec: OverlaySpec, measure: Measure): OverlayPlan {
  const { video, text, textScale } = spec;
  const fullFrame = { x: 0, y: 0, width: video.width, height: video.height };
  const texts: { layout: TextLayout; style: TextStyle }[] = [];
  const add = (
    value: string,
    box: Rect,
    style: TextStyle,
    fit: Parameters<typeof layoutText>[3],
  ) => {
    if (value.trim()) texts.push({ layout: layoutText(value, box, style, fit, measure), style });
  };
  const drawTexts = (context: OverlayCanvas) => {
    for (const { layout, style } of texts) drawText(context, layout, style);
  };

  if (spec.layout === 'caption-bar') {
    const geometry = captionBarGeometry(video, text.top, textScale, measure);
    return {
      frame: geometry.frame,
      video: geometry.video,
      draw: (context) => {
        context.fillStyle = BAR_COLOR;
        context.fillRect(0, 0, geometry.frame.width, geometry.bar);
        if (text.top.trim()) drawText(context, geometry.layout, geometry.style);
      },
    };
  }

  if (spec.layout === 'freeze-zoom') {
    const geometry = freezeZoomGeometry(video, textScale);
    add(text.top, geometry.box, geometry.style, geometry.fit);
    return { frame: geometry.frame, video: fullFrame, draw: drawTexts };
  }

  const geometry = topBottomGeometry(video, textScale);
  add(text.top, geometry.boxes.top, geometry.styles.top, geometry.fit);
  add(text.bottom, geometry.boxes.bottom, geometry.styles.bottom, geometry.fit);
  return { frame: geometry.frame, video: fullFrame, draw: drawTexts };
}
