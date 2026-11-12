import { describe, expect, it } from 'vitest';
import { THEME_INIT_SCRIPT, THEME_STORAGE_KEY, nextTheme } from './theme';

describe('nextTheme', () => {
  it('flips a stored choice', () => {
    expect(nextTheme('light', true)).toBe('dark');
    expect(nextTheme('dark', false)).toBe('light');
  });

  it('flips the system theme when nothing is stored', () => {
    expect(nextTheme(null, true)).toBe('light');
    expect(nextTheme(null, false)).toBe('dark');
  });

  it('ignores a corrupt stored value', () => {
    expect(nextTheme('purple', false)).toBe('dark');
  });
});

describe('THEME_INIT_SCRIPT', () => {
  function run(stored: string | null): Record<string, string> {
    const dataset: Record<string, string> = {};
    const localStorage = { getItem: (key: string) => (key === THEME_STORAGE_KEY ? stored : null) };
    new Function('localStorage', 'document', THEME_INIT_SCRIPT)(localStorage, {
      documentElement: { dataset },
    });
    return dataset;
  }

  it('applies a stored theme', () => {
    expect(run('dark')).toEqual({ theme: 'dark' });
  });

  it('leaves the system theme alone when nothing valid is stored', () => {
    expect(run(null)).toEqual({});
    expect(run('purple')).toEqual({});
  });

  it('survives storage being blocked', () => {
    const blocked = {
      getItem: () => {
        throw new Error('blocked');
      },
    };
    expect(() =>
      new Function('localStorage', 'document', THEME_INIT_SCRIPT)(blocked, {}),
    ).not.toThrow();
  });
});
