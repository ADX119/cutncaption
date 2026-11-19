/**
 * Draws caption text onto a 2D canvas context that the caller passes in: the preview
 * canvas, the export overlay and (later) WebCodecs frames all use this, which is what
 * makes the preview match the export. Pure layout maths plus a few context calls; no
 * DOM access of its own.
 *
 * Every position comes from the font size, and the size from the box, so the same text
 * in a box twice as big lays out exactly twice as big.
 */

export interface Box {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface TextStyle {
  /** CSS font-family list, e.g. `"Anton", "Noto Sans Devanagari"`. */
  readonly family: string;
  /** The loaded face's weight; any other value makes the browser fake one. */
  readonly weight: number;
  readonly color: string;
  /** Stroke drawn under the fill. `width` is the stroke's line width as a fraction of the font size. */
  readonly outline?: { readonly color: string; readonly width: number };
  readonly align: 'left' | 'center' | 'right';
  readonly verticalAlign: 'top' | 'middle' | 'bottom';
  /** Line pitch as a multiple of the font size. */
  readonly lineHeight: number;
  /** Capitalise Latin text (scripts without case are unchanged). */
  readonly uppercase?: boolean;
}

/** Font sizes in pixels: the size wanted, and the smallest the text may shrink to. */
export interface FitRange {
  readonly maxSize: number;
  readonly minSize: number;
}

/** Width of `text` set in the CSS font shorthand `font`. */
export type Measure = (text: string, font: string) => number;

export interface TextLine {
  readonly text: string;
  /** Vertical centre of the line (drawn with `textBaseline = 'middle'`). */
  readonly y: number;
}

export interface TextLayout {
  readonly size: number;
  readonly font: string;
  readonly lines: readonly TextLine[];
  /** Anchor for every line, read with `textAlign` from the style. */
  readonly x: number;
  readonly strokeWidth: number;
  /** Top of the first line and height of the whole block, outline excluded. */
  readonly top: number;
  readonly height: number;
  /** True when even the smallest size does not fit, so text spills or words split. */
  readonly overflows: boolean;
}

/** The context members the renderer uses; both canvas and OffscreenCanvas contexts fit. */
export type TextCanvas = Pick<
  CanvasRenderingContext2D,
  | 'font'
  | 'fillStyle'
  | 'strokeStyle'
  | 'lineWidth'
  | 'lineJoin'
  | 'miterLimit'
  | 'textAlign'
  | 'textBaseline'
  | 'save'
  | 'restore'
  | 'measureText'
  | 'fillText'
  | 'strokeText'
>;

export function fontString(style: Pick<TextStyle, 'family' | 'weight'>, size: number): string {
  return `${style.weight} ${size}px ${style.family}`;
}

/** A Measure backed by a real context. */
export function canvasMeasure(context: Pick<TextCanvas, 'font' | 'measureText'>): Measure {
  return (text, font) => {
    context.font = font;
    return context.measureText(text).width;
  };
}

let segmenter: Intl.Segmenter | undefined;

/** User-perceived characters. A Devanagari conjunct with its vowel sign is one. */
function splitGraphemes(text: string): string[] {
  segmenter ??= new Intl.Segmenter(undefined, { granularity: 'grapheme' });
  return Array.from(segmenter.segment(text), (part) => part.segment);
}

/** Splits a word wider than the line into pieces that fit, one grapheme at least each. */
function splitWord(word: string, maxWidth: number, width: (text: string) => number): string[] {
  const pieces: string[] = [];
  let current = '';
  for (const grapheme of splitGraphemes(word)) {
    const candidate = current + grapheme;
    if (current && width(candidate) > maxWidth) {
      pieces.push(current);
      current = grapheme;
    } else {
      current = candidate;
    }
  }
  if (current) pieces.push(current);
  return pieces;
}

/**
 * Greedy word wrap. Keeps the person's own line breaks; splits a word only when it is
 * wider than a whole line, and reports that so the caller can try a smaller size first.
 */
export function wrapText(
  text: string,
  maxWidth: number,
  width: (text: string) => number,
): { lines: string[]; brokeWord: boolean } {
  const paragraphs = text.replace(/\r\n?/g, '\n').trim().split('\n');
  if (paragraphs.length === 1 && paragraphs[0]?.trim() === '')
    return { lines: [], brokeWord: false };

  const lines: string[] = [];
  let brokeWord = false;
  for (const paragraph of paragraphs) {
    const words = paragraph.split(/[ \t]+/).filter(Boolean);
    if (words.length === 0) {
      lines.push('');
      continue;
    }
    let current = '';
    for (const word of words) {
      const candidate = current ? `${current} ${word}` : word;
      if (width(candidate) <= maxWidth) {
        current = candidate;
        continue;
      }
      if (current) lines.push(current);
      if (width(word) <= maxWidth) {
        current = word;
      } else {
        brokeWord = true;
        const pieces = splitWord(word, maxWidth, width);
        lines.push(...pieces.slice(0, -1));
        current = pieces.at(-1) ?? '';
      }
    }
    lines.push(current);
  }
  return { lines, brokeWord };
}

interface Attempt {
  readonly size: number;
  readonly lines: string[];
  readonly strokeWidth: number;
  readonly height: number;
  readonly fits: boolean;
}

function attempt(
  text: string,
  box: Box,
  style: TextStyle,
  size: number,
  measure: Measure,
): Attempt {
  const font = fontString(style, size);
  const strokeWidth = (style.outline?.width ?? 0) * size;
  const { lines, brokeWord } = wrapText(text, box.width - strokeWidth, (part) =>
    measure(part, font),
  );
  const height = lines.length * style.lineHeight * size;
  return {
    size,
    lines,
    strokeWidth,
    height,
    fits: !brokeWord && height + strokeWidth <= box.height,
  };
}

/** Halvings of the size range: precise to well under a hundredth of a pixel. */
const SEARCH_STEPS = 16;

/**
 * Lays text out in a box at the largest size up to `fit.maxSize` that fits without
 * splitting a word. Text wraps onto more lines before it shrinks, as long as the lines
 * fit the box's height.
 */
export function layoutText(
  text: string,
  box: Box,
  style: TextStyle,
  fit: FitRange,
  measure: Measure,
): TextLayout {
  const content = style.uppercase ? text.toUpperCase() : text;
  const minSize = Math.min(fit.minSize, fit.maxSize);

  let best = attempt(content, box, style, fit.maxSize, measure);
  if (!best.fits) {
    const floor = attempt(content, box, style, minSize, measure);
    best = floor;
    if (floor.fits) {
      // Largest fitting size between the two: fits at `low`, not at `high`.
      let low = minSize;
      let high = fit.maxSize;
      for (let step = 0; step < SEARCH_STEPS; step += 1) {
        const middle = (low + high) / 2;
        const tried = attempt(content, box, style, middle, measure);
        if (tried.fits) {
          low = middle;
          best = tried;
        } else {
          high = middle;
        }
      }
    }
  }

  const { size, lines, strokeWidth, height } = best;
  const inset = strokeWidth / 2;
  const top =
    style.verticalAlign === 'top'
      ? box.y + inset
      : style.verticalAlign === 'bottom'
        ? box.y + box.height - height - inset
        : box.y + (box.height - height) / 2;
  const x =
    style.align === 'left'
      ? box.x + inset
      : style.align === 'right'
        ? box.x + box.width - inset
        : box.x + box.width / 2;
  const pitch = style.lineHeight * size;

  return {
    size,
    font: fontString(style, size),
    lines: lines.map((line, index) => ({ text: line, y: top + (index + 0.5) * pitch })),
    x,
    strokeWidth,
    top,
    height,
    overflows: lines.length > 0 && !best.fits,
  };
}

/** Draws a layout: every outline first, then every fill, so no outline covers a letter. */
export function drawText(context: TextCanvas, layout: TextLayout, style: TextStyle): void {
  context.save();
  context.font = layout.font;
  context.textAlign = style.align;
  context.textBaseline = 'middle';
  if (style.outline && layout.strokeWidth > 0) {
    context.strokeStyle = style.outline.color;
    context.lineWidth = layout.strokeWidth;
    // Round joins: mitred joins spike out of sharp letters like M and V.
    context.lineJoin = 'round';
    context.miterLimit = 2;
    for (const line of layout.lines) context.strokeText(line.text, layout.x, line.y);
  }
  context.fillStyle = style.color;
  for (const line of layout.lines) context.fillText(line.text, layout.x, line.y);
  context.restore();
}
