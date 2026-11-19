import type { Page } from '@playwright/test';
import { downloadAndProbe, openToolWith } from './support/tools';
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

/**
 * Types into a caption field and checks it took. If this ever fails, the typing never
 * reached the field; a later failure means the studio lost text it had.
 */
async function typeCaption(page: Page, label: string, text: string) {
  const field = page.getByRole('textbox', { name: label });
  await field.fill(text);
  await expect(field).toHaveValue(text);
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

  await typeCaption(page, 'Top text', 'when the preview');
  await expect.poll(() => inkBetween(page, 0, 0.3)).toBeGreaterThan(200);
  expect(await inkBetween(page, 0.3, 1)).toBe(0);

  await typeCaption(page, 'Bottom text', 'matches the export');
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
  await typeCaption(page, 'Top text', 'me explaining memes');
  const plain = await size(page);
  expect(plain.width / plain.height).toBeCloseTo(16 / 9, 1);

  await page.getByText('Caption bar', { exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'Caption' })).toHaveValue('me explaining memes');
  await expect(page.getByRole('textbox', { name: 'Bottom text' })).toHaveCount(0);
  await expect
    .poll(async () => (await size(page)).height / (await size(page)).width)
    .toBeGreaterThan(9 / 16 + 0.05);

  // The bar is drawn (once the fonts are in, which on a first visit takes a moment);
  // the video area below it stays clear.
  const frame = await size(page);
  const barShare = 1 - (plain.height * (frame.width / plain.width)) / frame.height;
  await expect.poll(() => inkBetween(page, 0, barShare * 0.9)).toBeGreaterThan(0);
  expect(await inkBetween(page, barShare + 0.05, 1)).toBe(0);
});

test('Make meme saves the moment as an MP4, then returns to the studio with the text kept', async ({
  page,
}) => {
  test.setTimeout(180_000);
  await openToolWith(page, '/tools/video-meme-maker/', 'landscape-720p.mp4', 'meme-studio');
  await typeCaption(page, 'Top text', 'when the export');
  await typeCaption(page, 'Bottom text', 'matches the preview');
  await page.getByRole('button', { name: 'Make meme' }).click();

  const result = await downloadAndProbe(page);
  expect(result.filename).toBe('landscape-720p-meme.mp4');
  expect(result.info.video).toMatchObject({
    codec: 'h264',
    displayWidth: 1280,
    displayHeight: 720,
  });
  // The studio starts with the first 5 seconds, all of this clip.
  expect(result.info.durationSec).toBeGreaterThan(4.9);
  expect(result.info.durationSec).toBeLessThan(5.15);

  await page.getByRole('button', { name: 'Start over' }).click();
  await expect(page.getByTestId('meme-studio')).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Top text' })).toHaveValue('when the export');
});

test('layouts and formats that cannot be saved yet say so instead of offering a button', async ({
  page,
}) => {
  test.setTimeout(120_000);
  await openToolWith(page, '/tools/video-to-gif/', 'clip.mov', 'meme-studio');
  await expect(page.getByTestId('meme-not-yet')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Make meme' })).toHaveCount(0);
  await page.getByText('MP4', { exact: true }).click();
  await expect(page.getByRole('button', { name: 'Make meme' })).toBeVisible();
  await page.getByText('Caption bar', { exact: true }).click();
  await expect(page.getByTestId('meme-not-yet')).toBeVisible();
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
