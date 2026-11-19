import { describe, expect, it } from 'vitest';
import {
  type Box,
  type Measure,
  type TextCanvas,
  type TextStyle,
  canvasMeasure,
  drawText,
  fontString,
  layoutText,
  wrapText,
} from './text';

const graphemes = (text: string) =>
  [...new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(text)].length;

/** Every grapheme (spaces included) is half the font size wide. */
const measure: Measure = (text, font) => {
  const size = Number(/([\d.]+)px/.exec(font)?.[1]);
  return graphemes(text) * size * 0.5;
};

/** Ten units per grapheme, for wrapping tests that do not involve sizes. */
const tenEach = (text: string) => graphemes(text) * 10;

const STYLE: TextStyle = {
  family: '"Anton", "Noto Sans Devanagari"',
  weight: 400,
  color: '#fff',
  align: 'center',
  verticalAlign: 'top',
  lineHeight: 1.2,
};

const BOX: Box = { x: 0, y: 0, width: 1000, height: 1000 };

describe('fontString', () => {
  it('builds a CSS font shorthand with the exact weight', () => {
    expect(fontString(STYLE, 48)).toBe('400 48px "Anton", "Noto Sans Devanagari"');
  });
});

describe('wrapText', () => {
  it('keeps text that fits on one line', () => {
    expect(wrapText('when the code works', 1000, tenEach)).toEqual({
      lines: ['when the code works'],
      brokeWord: false,
    });
  });

  it('breaks greedily at spaces', () => {
    expect(wrapText('aaaa bbbb cccc', 100, tenEach).lines).toEqual(['aaaa bbbb', 'cccc']);
  });

  it('keeps line breaks the person typed, including blank lines', () => {
    expect(wrapText('top\n\nbottom', 1000, tenEach).lines).toEqual(['top', '', 'bottom']);
    expect(wrapText('a\r\nb', 1000, tenEach).lines).toEqual(['a', 'b']);
  });

  it('collapses runs of spaces and trims the ends', () => {
    expect(wrapText('  so \t  true  ', 1000, tenEach).lines).toEqual(['so true']);
  });

  it('returns no lines for empty text', () => {
    expect(wrapText('', 100, tenEach)).toEqual({ lines: [], brokeWord: false });
    expect(wrapText('   ', 100, tenEach)).toEqual({ lines: [], brokeWord: false });
  });

  it('splits a word wider than the line, and says so', () => {
    expect(wrapText('ab cdefghijkl', 50, tenEach)).toEqual({
      lines: ['ab', 'cdefg', 'hijkl'],
      brokeWord: true,
    });
  });

  it('never splits inside a Devanagari cluster', () => {
    const word = 'क्षत्रियों';
    const { lines, brokeWord } = wrapText(word, 20, tenEach);
    expect(brokeWord).toBe(true);
    expect(lines.join('')).toBe(word);
    for (const line of lines) {
      // A line starting with a vowel sign or virama would mean a cluster was cut.
      expect(line).not.toMatch(/^\p{M}/u);
      expect(tenEach(line)).toBeLessThanOrEqual(20);
    }
  });
});

describe('layoutText', () => {
  it('uses the largest size when the text fits', () => {
    const layout = layoutText('hi', BOX, STYLE, { maxSize: 80, minSize: 10 }, measure);
    expect(layout.size).toBe(80);
    expect(layout.lines.map((line) => line.text)).toEqual(['hi']);
    expect(layout.overflows).toBe(false);
  });

  it('shrinks a long word to fit the width instead of splitting it', () => {
    const word = 'x'.repeat(20);
    const box = { x: 0, y: 0, width: 200, height: 300 };
    const layout = layoutText(word, box, STYLE, { maxSize: 100, minSize: 4 }, measure);
    // 20 graphemes at half the size each: 10 × size ≤ 200.
    expect(layout.size).toBeCloseTo(20, 1);
    expect(layout.size).toBeLessThanOrEqual(20);
    expect(layout.lines.map((line) => line.text)).toEqual([word]);
  });

  it('wraps onto more lines before shrinking, while the height allows', () => {
    const box = { x: 0, y: 0, width: 300, height: 1000 };
    const layout = layoutText(
      'one two three four',
      box,
      STYLE,
      { maxSize: 50, minSize: 10 },
      measure,
    );
    expect(layout.size).toBe(50);
    expect(layout.lines.length).toBeGreaterThan(1);
  });

  it('shrinks when the wrapped lines are too tall for the box', () => {
    const box = { x: 0, y: 0, width: 300, height: 70 };
    const layout = layoutText(
      'one two three four',
      box,
      STYLE,
      { maxSize: 50, minSize: 10 },
      measure,
    );
    expect(layout.size).toBeLessThan(50);
    expect(layout.height).toBeLessThanOrEqual(70);
    expect(layout.overflows).toBe(false);
  });

  it('stops at the minimum size and reports the overflow', () => {
    const box = { x: 0, y: 0, width: 40, height: 20 };
    const layout = layoutText(
      'far too much text here',
      box,
      STYLE,
      { maxSize: 50, minSize: 12 },
      measure,
    );
    expect(layout.size).toBe(12);
    expect(layout.overflows).toBe(true);
    expect(layout.lines.length).toBeGreaterThan(0);
  });

  it('keeps the outline inside the box', () => {
    const style = { ...STYLE, align: 'left' as const, outline: { color: '#000', width: 0.1 } };
    const box = { x: 10, y: 20, width: 202, height: 500 };
    const layout = layoutText('x'.repeat(20), box, style, { maxSize: 100, minSize: 4 }, measure);
    // Width 10 × size plus a stroke of 0.1 × size must fit in 202.
    expect(layout.size).toBeCloseTo(20, 1);
    expect(layout.strokeWidth).toBeCloseTo(layout.size * 0.1, 5);
    expect(layout.x).toBeCloseTo(10 + layout.strokeWidth / 2, 5);
    expect(layout.top).toBeCloseTo(20 + layout.strokeWidth / 2, 5);
  });

  it('places lines by alignment', () => {
    const box = { x: 100, y: 0, width: 400, height: 1000 };
    const fit = { maxSize: 40, minSize: 10 };
    expect(layoutText('a', box, { ...STYLE, align: 'center' }, fit, measure).x).toBe(300);
    expect(layoutText('a', box, { ...STYLE, align: 'left' }, fit, measure).x).toBe(100);
    expect(layoutText('a', box, { ...STYLE, align: 'right' }, fit, measure).x).toBe(500);
  });

  it('anchors the block to the top, middle or bottom of the box', () => {
    const box = { x: 0, y: 100, width: 1000, height: 200 };
    const fit = { maxSize: 50, minSize: 10 };
    const at = (verticalAlign: TextStyle['verticalAlign']) =>
      layoutText('a\nb', box, { ...STYLE, verticalAlign }, fit, measure);

    // Two lines of 1.2 × 50 = 120 tall.
    expect(at('top').top).toBe(100);
    expect(at('middle').top).toBe(140);
    expect(at('bottom').top).toBe(180);
    expect(at('top').lines.map((line) => line.y)).toEqual([130, 190]);
    expect(at('top').height).toBe(120);
  });

  it('can set Latin in capitals and leaves Devanagari as typed', () => {
    const style = { ...STYLE, uppercase: true };
    const fit = { maxSize: 40, minSize: 10 };
    expect(layoutText('me irl', BOX, style, fit, measure).lines[0]?.text).toBe('ME IRL');
    expect(layoutText('मैं ठीक हूँ', BOX, style, fit, measure).lines[0]?.text).toBe('मैं ठीक हूँ');
  });

  it('scales evenly, so the preview and the export agree', () => {
    const text = 'nobody: absolutely nobody: me at 3am';
    const fit = { maxSize: 60, minSize: 8 };
    const small = layoutText(text, { x: 0, y: 0, width: 320, height: 90 }, STYLE, fit, measure);
    const big = layoutText(
      text,
      { x: 0, y: 0, width: 1280, height: 360 },
      STYLE,
      { maxSize: 240, minSize: 32 },
      measure,
    );
    expect(big.lines.map((line) => line.text)).toEqual(small.lines.map((line) => line.text));
    expect(big.size / small.size).toBeCloseTo(4, 2);
    expect(big.top / 4).toBeCloseTo(small.top, 1);
  });

  it('lays out nothing for empty text', () => {
    const layout = layoutText('', BOX, STYLE, { maxSize: 40, minSize: 10 }, measure);
    expect(layout.lines).toEqual([]);
    expect(layout.height).toBe(0);
    expect(layout.overflows).toBe(false);
  });
});

/** A 2D context that records what was drawn. */
function recordingCanvas() {
  const calls: string[] = [];
  const state = {
    font: '',
    fillStyle: '' as string | CanvasGradient | CanvasPattern,
    strokeStyle: '' as string | CanvasGradient | CanvasPattern,
    lineWidth: 1,
    lineJoin: 'miter' as CanvasLineJoin,
    miterLimit: 10,
    textAlign: 'start' as CanvasTextAlign,
    textBaseline: 'alphabetic' as CanvasTextBaseline,
  };
  const canvas: TextCanvas = Object.assign(state, {
    save: () => calls.push('save'),
    restore: () => calls.push('restore'),
    measureText: (text: string) => ({ width: measure(text, state.font) }) as TextMetrics,
    fillText: (text: string, x: number, y: number) =>
      calls.push(`fill ${text} ${x} ${y} ${String(state.fillStyle)}`),
    strokeText: (text: string, x: number, y: number) =>
      calls.push(`stroke ${text} ${x} ${y} ${state.lineWidth} ${state.lineJoin}`),
  });
  return { canvas, calls, state };
}

describe('drawText', () => {
  it('strokes every line before filling any, so outlines never cover text', () => {
    const style = { ...STYLE, outline: { color: '#000', width: 0.1 } };
    const layout = layoutText('a\nb', BOX, style, { maxSize: 50, minSize: 10 }, measure);
    const { canvas, calls, state } = recordingCanvas();
    drawText(canvas, layout, style);

    expect(calls.map((call) => call.split(' ').slice(0, 2).join(' '))).toEqual([
      'save',
      'stroke a',
      'stroke b',
      'fill a',
      'fill b',
      'restore',
    ]);
    expect(calls[1]).toContain(' 5 round');
    expect(calls[3]).toContain('#fff');
    expect(state.textBaseline).toBe('middle');
    expect(state.textAlign).toBe('center');
    expect(state.font).toBe(layout.font);
  });

  it('only fills when there is no outline', () => {
    const layout = layoutText('a', BOX, STYLE, { maxSize: 50, minSize: 10 }, measure);
    const { canvas, calls } = recordingCanvas();
    drawText(canvas, layout, STYLE);
    expect(calls.filter((call) => call.startsWith('stroke'))).toEqual([]);
    expect(calls.filter((call) => call.startsWith('fill'))).toHaveLength(1);
  });
});

describe('canvasMeasure', () => {
  it('measures with the given font', () => {
    const { canvas } = recordingCanvas();
    expect(canvasMeasure(canvas)('abcd', '400 10px x')).toBe(20);
  });
});
