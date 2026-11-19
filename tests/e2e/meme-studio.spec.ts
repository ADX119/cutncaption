import type { Page } from '@playwright/test';
import { openToolWith } from './support/tools';
import { expect, test } from './support/test';

const overlay = (page: Page) => page.getByTestId('meme-overlay');

/** Drawn (non-transparent) pixels of the caption layer between two fractions of its height. */
function inkBetween(page: Page, from: number, to: number) {
  return overlay(page).evaluate(
    (canvas: HTMLCanvasElement, [top, bottom]) => {
      const context = canvas.getContext('2d');
      if (!context) return -1;
      const y = Math.floor(canvas.height * top);
      const height = Math.max(1, Math.floor(canvas.height * bottom) - y);
      const { data } = context.getImageData(0, y, canvas.width, height);
      let count = 0;
      for (let i = 3; i < data.length; i += 4) if (data[i] !== 0) count += 1;
      return count;
    },
    [from, to] as const,
  );
}

const size = (page: Page) =>
  overlay(page).evaluate((canvas: HTMLCanvasElement) => ({
    width: canvas.width,
    height: canvas.height,
  }));

test('typing draws the caption over the video, where the layout puts it', async ({ page }) => {
  test.setTimeout(120_000);
  await openToolWith(page, '/tools/video-meme-maker/', 'landscape-720p.mp4', 'meme-studio');
  await expect(overlay(page)).toBeVisible();
  expect(await inkBetween(page, 0, 1)).toBe(0);

  await page.getByRole('textbox', { name: 'Top text' }).fill('when the preview');
  await expect.poll(() => inkBetween(page, 0, 0.3)).toBeGreaterThan(200);
  expect(await inkBetween(page, 0.3, 1)).toBe(0);

  await page.getByRole('textbox', { name: 'Bottom text' }).fill('matches the export');
  await expect.poll(() => inkBetween(page, 0.7, 1)).toBeGreaterThan(200);
  // The middle of the picture stays clear.
  expect(await inkBetween(page, 0.35, 0.65)).toBe(0);

  // A bigger text size puts more ink on the canvas.
  const before = await inkBetween(page, 0, 0.3);
  await page.getByRole('slider', { name: 'Text size' }).fill('1.5');
  await expect.poll(() => inkBetween(page, 0, 0.3)).toBeGreaterThan(before * 1.3);
});

test('the caption bar adds a white bar above the video and keeps the text', async ({ page }) => {
  test.setTimeout(120_000);
  await openToolWith(page, '/tools/video-meme-maker/', 'landscape-720p.mp4', 'meme-studio');
  await page.getByRole('textbox', { name: 'Top text' }).fill('me explaining memes');
  const plain = await size(page);
  expect(plain.width / plain.height).toBeCloseTo(16 / 9, 1);

  await page.getByText('Caption bar', { exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'Caption' })).toHaveValue('me explaining memes');
  await expect(page.getByRole('textbox', { name: 'Bottom text' })).toHaveCount(0);
  await expect
    .poll(async () => (await size(page)).height / (await size(page)).width)
    .toBeGreaterThan(9 / 16 + 0.05);

  // The bar is opaque across its whole width; the video area below it stays clear.
  const barShare =
    1 - (plain.height * ((await size(page)).width / plain.width)) / (await size(page)).height;
  expect(await inkBetween(page, 0, barShare * 0.9)).toBeGreaterThan(0);
  expect(await inkBetween(page, barShare + 0.05, 1)).toBe(0);
});

test.describe('page presets', () => {
  for (const [slug, format] of [
    ['video-meme-maker', 'MP4'],
    ['video-to-gif', 'GIF'],
    ['video-to-whatsapp-sticker', 'Sticker'],
    ['video-to-image', 'Image'],
  ] as const) {
    test(`${slug} opens the studio with ${format} selected`, async ({ page }) => {
      test.setTimeout(120_000);
      await openToolWith(page, `/tools/${slug}/`, 'clip.mov', 'meme-studio');
      await expect(page.getByRole('radio', { name: format })).toBeChecked();
    });
  }
});
