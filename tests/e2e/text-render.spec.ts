import type { Page } from '@playwright/test';
import { expect, test } from './support/test';

const SAMPLES = ['latin', 'hindi', 'bar', 'fit', 'portrait'] as const;

async function openSamples(page: Page) {
  await page.goto('/preview/text/');
  for (const id of SAMPLES) {
    await expect(page.getByTestId(`text-sample-${id}`)).toHaveAttribute('data-drawn', 'true');
  }
}

/** Pure white pixels in a band of a sample canvas: caption fill, never the stand-in frame. */
function whitePixels(page: Page, id: string, fromY: number, toY: number) {
  return page.getByTestId(`text-sample-${id}`).evaluate(
    (canvas: HTMLCanvasElement, [from, to]) => {
      const context = canvas.getContext('2d');
      if (!context) return -1;
      const { data } = context.getImageData(0, from, canvas.width, to - from);
      let count = 0;
      for (let i = 0; i < data.length; i += 4) {
        if (data[i] === 255 && data[i + 1] === 255 && data[i + 2] === 255) count += 1;
      }
      return count;
    },
    [fromY, toY] as const,
  );
}

test('top and bottom text is drawn in its bands, in both scripts', async ({ page }) => {
  await openSamples(page);
  for (const id of ['latin', 'hindi']) {
    // Top band (rows 10–100) and bottom band (260–350) hold text; the middle stays clear.
    expect(await whitePixels(page, id, 10, 100), `${id} top`).toBeGreaterThan(1500);
    expect(await whitePixels(page, id, 260, 350), `${id} bottom`).toBeGreaterThan(1500);
    expect(await whitePixels(page, id, 140, 220), `${id} middle`).toBe(0);
  }
});

test.describe('screenshots', () => {
  // Baselines are recorded on Windows; Linux rasterises the same fonts slightly
  // differently, so CI (Ubuntu) relies on the pixel test above instead.
  test.skip(Boolean(process.env.CI), 'screenshot baselines are per operating system');

  test('Latin and Devanagari samples match the reviewed screenshots', async ({ page }) => {
    await openSamples(page);
    for (const id of SAMPLES) {
      await expect(page.getByTestId(`text-sample-${id}`)).toHaveScreenshot(`${id}.png`, {
        maxDiffPixelRatio: 0.01,
      });
    }
  });
});
