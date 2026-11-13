import { describe, expect, it } from 'vitest';
import { ENGINE_ERROR_CODES, EngineError } from '../src/engine/errors';
import { en } from '../src/i18n/messages/en';

// Lives outside src/ because it deliberately crosses a module boundary: the engine
// may not import i18n, yet every engine error needs a user-facing message.
describe('engine error messages', () => {
  it.each(ENGINE_ERROR_CODES)('"%s" has a message in the catalogue', (code) => {
    const key = new EngineError(code).messageKey;
    expect(en).toHaveProperty([key]);
  });

  it('has no messages for codes that no longer exist', () => {
    const known = new Set(ENGINE_ERROR_CODES.map((code) => `error.${code}`));
    const stale = Object.keys(en).filter((key) => key.startsWith('error.') && !known.has(key));
    expect(stale).toEqual([]);
  });
});
