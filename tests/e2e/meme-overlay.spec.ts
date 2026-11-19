import { callEngine, openEngine } from './support/engine';
import { expect, test } from './support/test';

const LANDSCAPE = { width: 1280, height: 720 };

test.describe('caption layer as a PNG at output size', () => {
  test.beforeEach(async ({ page }) => {
    await openEngine(page);
  });

  test('top and bottom text: frame-sized, transparent, ink only in the text boxes', async ({
    page,
  }) => {
    const check = await callEngine(page, 'overlayCheck', {
      layout: 'top-bottom',
      video: LANDSCAPE,
      text: { top: 'when the export', bottom: 'matches the preview' },
      textScale: 1,
    });
    expect(check).toMatchObject({ type: 'image/png', pngSignature: true, ...LANDSCAPE });
    expect(check.inkInside).toBeGreaterThan(5000);
    expect(check.inkOutside).toBe(0);
  });

  test('an empty bottom box stays empty', async ({ page }) => {
    const check = await callEngine(page, 'overlayCheck', {
      layout: 'top-bottom',
      video: LANDSCAPE,
      text: { top: 'only the top', bottom: '' },
      textScale: 1.4,
    });
    expect(check.inkInside).toBeGreaterThan(1000);
    expect(check.inkOutside).toBe(0);
  });

  test('portrait video', async ({ page }) => {
    const check = await callEngine(page, 'overlayCheck', {
      layout: 'top-bottom',
      video: { width: 720, height: 1280 },
      text: { top: 'when the export', bottom: 'matches the preview' },
      textScale: 1,
    });
    expect(check).toMatchObject({ width: 720, height: 1280 });
    expect(check.inkInside).toBeGreaterThan(2000);
    expect(check.inkOutside).toBe(0);
  });

  test('caption bar: a taller frame, an opaque bar, a clear video area', async ({ page }) => {
    const check = await callEngine(page, 'overlayCheck', {
      layout: 'caption-bar',
      video: LANDSCAPE,
      text: { top: 'me explaining Hinglish captions to my नानी', bottom: '' },
      textScale: 1,
    });
    expect(check.width).toBe(1280);
    expect(check.height).toBeGreaterThan(720);
    expect(check.height % 2).toBe(0);
    expect(check.opaqueInside).toBe(check.boxArea);
    expect(check.inkOutside).toBe(0);
  });

  test('freeze-frame zoom: the caption in the bottom box only', async ({ page }) => {
    const check = await callEngine(page, 'overlayCheck', {
      layout: 'freeze-zoom',
      video: LANDSCAPE,
      text: { top: 'wait for it', bottom: 'not used' },
      textScale: 1,
    });
    expect(check.inkInside).toBeGreaterThan(2000);
    expect(check.inkOutside).toBe(0);
  });

  test('Devanagari stays in its boxes, vowel signs included', async ({ page }) => {
    // Marks above the headline (ि, ँ) rise above the line; the layout makes room for them.
    const check = await callEngine(page, 'overlayCheck', {
      layout: 'top-bottom',
      video: LANDSCAPE,
      text: { top: 'दोस्त: बस पाँच मिनट में आया', bottom: 'ट्रेन: क्षमा करें श्रीमान्' },
      textScale: 1,
    });
    expect(check.inkInside).toBeGreaterThan(5000);
    expect(check.inkOutside).toBe(0);
  });
});
