import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { FONTS, FONT_IDS } from './fonts';

const DIR = path.join(process.cwd(), 'public', 'fonts');
// docs/ARCHITECTURE.md §6: fonts stay under 1 MB each.
const MAX_BYTES = 1024 * 1024;

describe('font files in public/fonts', () => {
  it.each(FONT_IDS)('%s exists, matches the registry and stays small', (id) => {
    const spec = FONTS[id];
    const data = fs.readFileSync(path.join(DIR, spec.file));
    expect(data.byteLength).toBe(spec.bytes);
    expect(data.byteLength).toBeLessThan(MAX_BYTES);
    // TrueType, not WOFF2: ffmpeg's FreeType is built without Brotli and cannot read WOFF2.
    expect(data.subarray(0, 4)).toEqual(Buffer.from([0, 1, 0, 0]));
  });

  it.each(FONT_IDS)('%s is named after its content, so it can be cached as immutable', (id) => {
    const { file } = FONTS[id];
    const sha256 = createHash('sha256')
      .update(fs.readFileSync(path.join(DIR, file)))
      .digest('hex');
    expect(file).toMatch(/\.[0-9a-f]{8}\.ttf$/);
    expect(sha256.startsWith(file.split('.').at(-2) ?? '-')).toBe(true);
  });

  it('ships the licence for every font and nothing else', () => {
    const fonts = FONT_IDS.map((id) => FONTS[id].file);
    const licences = [...new Set(FONT_IDS.map((id) => FONTS[id].licence))];
    expect(fs.readdirSync(DIR).sort()).toEqual([...fonts, ...licences].sort());
    for (const licence of licences) {
      expect(fs.readFileSync(path.join(DIR, licence), 'utf8')).toContain('SIL Open Font License');
    }
  });
});
