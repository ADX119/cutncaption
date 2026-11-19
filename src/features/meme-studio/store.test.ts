import { describe, expect, it } from 'vitest';
import { MAX_TEXT_LENGTH, createMemeStore } from './store';

describe('meme studio store', () => {
  it('starts with top and bottom text, empty captions, default size and the first 5 seconds', () => {
    const state = createMemeStore({ duration: 60 }).getState();
    expect(state).toMatchObject({
      layout: 'top-bottom',
      text: { top: '', bottom: '' },
      textScale: 1,
      format: 'mp4',
      range: { start: 0, end: 5 },
    });
  });

  it("starts with the page's export format", () => {
    expect(createMemeStore({ duration: 60, format: 'sticker' }).getState().format).toBe('sticker');
  });

  it('keeps the text when the layout changes, so nothing typed is lost', () => {
    const store = createMemeStore({ duration: 60 });
    store.getState().setText('top', 'when the build passes');
    store.getState().setText('bottom', 'first try');
    store.getState().setLayout('caption-bar');
    expect(store.getState().layout).toBe('caption-bar');
    expect(store.getState().text).toEqual({ top: 'when the build passes', bottom: 'first try' });
    store.getState().setLayout('top-bottom');
    expect(store.getState().text.bottom).toBe('first try');
  });

  it('caps text at the maximum length', () => {
    const store = createMemeStore({ duration: 60 });
    store.getState().setText('top', 'x'.repeat(MAX_TEXT_LENGTH + 50));
    expect(store.getState().text.top).toHaveLength(MAX_TEXT_LENGTH);
  });

  it('keeps the text size within the allowed range', () => {
    const store = createMemeStore({ duration: 60 });
    store.getState().setTextScale(1.3);
    expect(store.getState().textScale).toBe(1.3);
    store.getState().setTextScale(9);
    expect(store.getState().textScale).toBe(1.6);
    store.getState().setTextScale(0);
    expect(store.getState().textScale).toBe(0.5);
  });

  it('changes the export format and the moment', () => {
    const store = createMemeStore({ duration: 60 });
    store.getState().setFormat('gif');
    store.getState().setRange({ start: 12, end: 20 });
    expect(store.getState()).toMatchObject({ format: 'gif', range: { start: 12, end: 20 } });
  });

  it('gives each studio its own state', () => {
    const a = createMemeStore({ duration: 60 });
    const b = createMemeStore({ duration: 60 });
    a.getState().setText('top', 'only in a');
    expect(b.getState().text.top).toBe('');
  });
});
