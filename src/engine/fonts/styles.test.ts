import { describe, expect, it } from 'vitest';
import { BAR_STYLE, MEME_STYLE } from '@/editor/meme';
import { FONTS, FONT_IDS } from './fonts';

/** `"Anton", "Noto Sans Devanagari"` → ['Anton', 'Noto Sans Devanagari'] */
const families = (list: string) => list.split(',').map((name) => name.trim().replace(/^"|"$/g, ''));

describe.each([
  ['meme text', MEME_STYLE],
  ['caption bar', BAR_STYLE],
])('%s style', (_, style) => {
  const registered = new Map(FONT_IDS.map((id) => [FONTS[id].family, FONTS[id]]));

  it('only names fonts the studio ships', () => {
    for (const family of families(style.family)) expect(registered.has(family), family).toBe(true);
  });

  it('asks for the main font at its own weight, and no fallback lighter than that', () => {
    const [main, ...fallbacks] = families(style.family);
    expect(registered.get(main ?? '')?.weight).toBe(style.weight);
    // A face lighter than the requested weight would make the browser fake bold.
    for (const family of fallbacks) {
      expect(registered.get(family)?.weight ?? 0).toBeGreaterThanOrEqual(style.weight);
    }
  });
});
