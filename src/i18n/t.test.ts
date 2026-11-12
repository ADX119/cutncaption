import { describe, expect, it } from 'vitest';
import { en } from './messages/en';
import { format, t } from './t';

describe('t', () => {
  it('returns the catalogue string', () => {
    expect(t('app.name')).toBe(en['app.name']);
  });

  it('rejects unknown keys and missing params at compile time', () => {
    // @ts-expect-error unknown key
    expect(() => t('nope.nope')).toThrow();
    // @ts-expect-error this message takes no params
    t('app.name', { extra: 1 });
  });
});

describe('format', () => {
  it('fills placeholders', () => {
    expect(format('{done} of {total} MB', { done: 3, total: 32 })).toBe('3 of 32 MB');
  });

  it('fills a repeated placeholder everywhere', () => {
    expect(format('{n} + {n}', { n: 2 })).toBe('2 + 2');
  });

  it('leaves unknown placeholders visible', () => {
    expect(format('Hello {name}')).toBe('Hello {name}');
  });
});

describe('catalogue', () => {
  it('has no empty messages', () => {
    for (const [key, value] of Object.entries(en)) {
      expect(value.trim().length, key).toBeGreaterThan(0);
    }
  });
});
