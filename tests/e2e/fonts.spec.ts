import { callEngine, openEngine } from './support/engine';
import { expect, test } from './support/test';

test('the studio fonts load once and the page draws with each of them', async ({ page }) => {
  const fontRequests: string[] = [];
  page.on('request', (request) => {
    if (new URL(request.url()).pathname.startsWith('/fonts/')) fontRequests.push(request.url());
  });

  await openEngine(page);
  const fonts = await callEngine(page, 'fontsCheck');

  expect(fonts.map((font) => font.family)).toEqual(['Anton', 'Noto Sans', 'Noto Sans Devanagari']);
  for (const font of fonts) {
    expect(font.bytes, font.family).toBeGreaterThan(100_000);
    expect(font.check, `${font.family}: document.fonts.check`).toBe(true);
    // document.fonts lists only faces the page registered, so this holds even on a
    // machine that has the font installed (where the canvas check alone would pass).
    expect(font.faceLoaded, `${font.family}: face in document.fonts`).toBe(true);
    expect(font.drawsWithFont, `${font.family}: canvas draws with it`).toBe(true);
  }
  // fontsCheck loads everything twice; the second round is served from memory.
  expect(fontRequests).toHaveLength(3);

  // Content-hashed names, so the browser may keep them for a year.
  const response = await page.request.get(`/fonts/${fonts[0]?.file ?? ''}`);
  expect(response.status()).toBe(200);
  expect(response.headers()['cache-control']).toContain('immutable');
});
