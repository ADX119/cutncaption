import { describe, expect, it } from 'vitest';
import { customTargetBytes, presetTargetBytes } from './sizePresets';

describe('presetTargetBytes', () => {
  it.each([
    ['whatsapp', 15_520_000],
    ['discord', 19_400_000],
    ['email', 17_460_000],
  ] as const)('%s -> %d bytes', (id, bytes) => {
    expect(presetTargetBytes(id)).toBe(bytes);
  });

  it('stays under the limit whichever way a service counts a megabyte', () => {
    for (const [id, mb] of [
      ['whatsapp', 16],
      ['discord', 20],
      ['email', 18],
    ] as const) {
      expect(presetTargetBytes(id)).toBeLessThan(mb * 1_000_000);
      expect(presetTargetBytes(id)).toBeLessThan(mb * 1024 * 1024);
    }
  });
});

describe('customTargetBytes', () => {
  it.each([
    ['10', 9_700_000],
    ['2.5', 2_425_000],
    ['2,5', 2_425_000],
    [' 0.15 ', 145_500],
  ])('"%s" MB -> %d bytes', (text, bytes) => {
    expect(customTargetBytes(text)).toBe(bytes);
  });

  it.each(['', 'abc', '0', '-5', 'Infinity'])('rejects "%s"', (text) => {
    expect(customTargetBytes(text)).toBeNull();
  });
});
