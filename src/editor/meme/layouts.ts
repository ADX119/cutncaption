import {
  type Box,
  type FitRange,
  type Measure,
  type TextLayout,
  type TextStyle,
  layoutText,
} from '../render';

/**
 * Geometry of the three Meme Studio layouts (PRD §4.2), in output pixels. Everything is
 * a proportion of the video frame, so the preview (small canvas) and the export (full
 * size) are the same picture at two scales.
 */

export interface Size {
  readonly width: number;
  readonly height: number;
}

export type Rect = Box;

export type MemeLayoutId = 'top-bottom' | 'caption-bar' | 'freeze-zoom';

/*
 * Text styles. The colours are the meme's, part of the exported picture, not interface
 * colours. Family names match engine/fonts (checked by a test there).
 */

/** Classic meme text: heavy condensed capitals, white with a black outline. */
export const MEME_STYLE: TextStyle = {
  family: '"Anton", "Noto Sans Devanagari"',
  weight: 400,
  color: '#ffffff',
  outline: { color: '#000000', width: 0.14 },
  align: 'center',
  verticalAlign: 'top',
  lineHeight: 1.12,
  uppercase: true,
};

/** Caption bar text: black on white, centred, sentence case as typed. */
export const BAR_STYLE: TextStyle = {
  family: '"Noto Sans", "Noto Sans Devanagari"',
  weight: 700,
  color: '#000000',
  align: 'center',
  verticalAlign: 'middle',
  lineHeight: 1.3,
};

export const BAR_COLOR = '#ffffff';

/** The size control multiplies every default text size. */
export const TEXT_SCALE = { min: 0.5, max: 1.6, default: 1 } as const;

export function clampTextScale(scale: number): number {
  if (!Number.isFinite(scale)) return TEXT_SCALE.default;
  return Math.min(Math.max(scale, TEXT_SCALE.min), TEXT_SCALE.max);
}

/** Text may shrink to this share of its size before it overflows. */
const MIN_SIZE_RATIO = 0.35;

const evenCeil = (value: number) => Math.ceil(value / 2) * 2;

// ---------------------------------------------------------------------------------------
// 1. Top and bottom text

export interface TopBottomGeometry {
  readonly frame: Size;
  readonly boxes: { readonly top: Rect; readonly bottom: Rect };
  readonly styles: { readonly top: TextStyle; readonly bottom: TextStyle };
  readonly fit: FitRange;
}

/** Share of the frame height each text box may fill. */
const BOX_HEIGHT = 0.28;

/**
 * Text over the video, in a box at the top and one at the bottom. The size is 13% of the
 * frame height, capped at 11% of the width so a portrait video still fits a few words
 * per line; long text wraps, then shrinks.
 */
export function topBottomGeometry(
  video: Size,
  textScale: number = TEXT_SCALE.default,
): TopBottomGeometry {
  const margin = Math.min(video.width, video.height) * 0.04;
  const height = video.height * BOX_HEIGHT;
  const width = video.width - margin * 2;
  const maxSize = Math.min(video.height * 0.13, video.width * 0.11) * clampTextScale(textScale);
  return {
    frame: { width: video.width, height: video.height },
    boxes: {
      top: { x: margin, y: margin, width, height },
      bottom: { x: margin, y: video.height - margin - height, width, height },
    },
    styles: { top: MEME_STYLE, bottom: { ...MEME_STYLE, verticalAlign: 'bottom' } },
    fit: { maxSize, minSize: maxSize * MIN_SIZE_RATIO },
  };
}

// ---------------------------------------------------------------------------------------
// 2. Caption bar

export interface CaptionBarGeometry {
  readonly frame: Size;
  /** Height of the white bar above the video; even, for yuv420 video. */
  readonly bar: number;
  /** Where the video sits in the frame. */
  readonly video: Rect;
  readonly box: Rect;
  readonly style: TextStyle;
  readonly fit: FitRange;
  /** The caption laid out in the bar, ready to draw. */
  readonly layout: TextLayout;
}

/**
 * A white bar above the video, as tall as the caption needs: at least one line, at most
 * half the video's height. Text is 5% of the video width; past the maximum bar it
 * shrinks instead. Needs a measure because the bar's height depends on the wrapped text.
 */
export function captionBarGeometry(
  video: Size,
  text: string,
  textScale: number,
  measure: Measure,
): CaptionBarGeometry {
  const padX = video.width * 0.05;
  const padY = video.width * 0.035;
  const maxSize = video.width * 0.05 * clampTextScale(textScale);
  const fit = { maxSize, minSize: maxSize * MIN_SIZE_RATIO };
  const maxBar = evenCeil(video.height / 2);

  // Lay out in the tallest bar allowed to find the size and number of lines.
  const widest = { x: padX, y: padY, width: video.width - padX * 2, height: maxBar - padY * 2 };
  const trial = layoutText(text, widest, { ...BAR_STYLE, verticalAlign: 'top' }, fit, measure);
  const lines = Math.max(1, trial.lines.length);
  const bar = Math.min(evenCeil(lines * BAR_STYLE.lineHeight * trial.size + padY * 2), maxBar);

  const box = { x: padX, y: padY, width: widest.width, height: bar - padY * 2 };
  return {
    frame: { width: video.width, height: video.height + bar },
    bar,
    video: { x: 0, y: bar, width: video.width, height: video.height },
    box,
    style: BAR_STYLE,
    fit,
    layout: layoutText(text, box, BAR_STYLE, fit, measure),
  };
}

// ---------------------------------------------------------------------------------------
// 3. Freeze-frame zoom

export const FREEZE_ZOOM = {
  /** Seconds the frozen frame is held while it zooms. */
  minHold: 1,
  maxHold: 3,
  defaultHold: 2,
  /** Scale reached at the end of the hold. */
  maxZoom: 1.8,
} as const;

export function clampHold(seconds: number): number {
  if (!Number.isFinite(seconds)) return FREEZE_ZOOM.defaultHold;
  return Math.min(Math.max(seconds, FREEZE_ZOOM.minHold), FREEZE_ZOOM.maxHold);
}

/** Zoom at `progress` (0–1) through the hold: eased in and out (smoothstep). */
export function zoomScale(progress: number, maxZoom: number = FREEZE_ZOOM.maxZoom): number {
  const p = Math.min(Math.max(progress, 0), 1);
  return 1 + (maxZoom - 1) * p * p * (3 - 2 * p);
}

/**
 * The part of the frame shown at a zoom `scale`, centred on the focal point (0–1 in
 * each axis) but slid back inside the frame near the edges.
 */
export function zoomWindow(frame: Size, focal: { x: number; y: number }, scale: number): Rect {
  const s = Math.max(scale, 1);
  const width = frame.width / s;
  const height = frame.height / s;
  const clamp = (value: number, max: number) => Math.min(Math.max(value, 0), max);
  return {
    x: clamp(clamp(focal.x, 1) * frame.width - width / 2, frame.width - width),
    y: clamp(clamp(focal.y, 1) * frame.height - height / 2, frame.height - height),
    width,
    height,
  };
}

export interface FreezeZoomGeometry {
  readonly frame: Size;
  readonly box: Rect;
  readonly style: TextStyle;
  readonly fit: FitRange;
}

/** The caption appears in the bottom box when the frame freezes, styled as meme text. */
export function freezeZoomGeometry(
  video: Size,
  textScale: number = TEXT_SCALE.default,
): FreezeZoomGeometry {
  const { frame, boxes, styles, fit } = topBottomGeometry(video, textScale);
  return { frame, box: boxes.bottom, style: styles.bottom, fit };
}
