import { openToolWith } from './support/tools';
import { expect, test } from './support/test';

const ANDROID_UA =
  'Mozilla/5.0 (Linux; Android 13; Budget Phone) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36';

test.describe('on a low-end Android phone', () => {
  // Class L: an Android browser reporting 2 GB of memory.
  test.use({ userAgent: ANDROID_UA });
  test.beforeEach(async ({ page, browserName }) => {
    test.skip(browserName === 'webkit', 'Android phones run Chromium-based browsers');
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'deviceMemory', { get: () => 2 });
      Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => 4 });
    });
  });

  test('a precise trim too big for the phone to hold is blocked with a reason', async ({
    page,
  }) => {
    test.setTimeout(120_000);
    // 20 minutes re-encoded would be about 180 MB, over the 150 MB this phone can hold.
    await openToolWith(page, '/tools/trim-video/', 'long-tiny.mp4', 'trim-tool');
    await expect(page.getByTestId('limit-block')).toContainText('too large for this device');
    await expect(page.getByRole('button', { name: 'Trim video' })).toBeDisabled();

    // A fast trim only copies, so it is allowed.
    await page.getByText('Fast', { exact: true }).click();
    await expect(page.getByTestId('limit-block')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Trim video' })).toBeEnabled();
  });

  test('a long re-encode warns but is allowed', async ({ page }) => {
    test.setTimeout(120_000);
    // Compress estimates by resolution, so this tiny picture stays small enough to
    // hold; the 20 minutes is still a long job on this phone.
    await openToolWith(page, '/tools/compress-video/', 'long-tiny.mp4', 'compress-tool');
    await expect(page.getByTestId('limit-warning')).toContainText('long job for this device');
    await expect(page.getByTestId('limit-block')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Compress video' })).toBeEnabled();
  });
});

test('the same trim is fine on a desktop', async ({ page, browserName }) => {
  test.skip(browserName === 'webkit' || test.info().project.name !== 'chromium', 'desktop only');
  test.setTimeout(120_000);
  await openToolWith(page, '/tools/trim-video/', 'long-tiny.mp4', 'trim-tool');
  await expect(page.getByTestId('limit-block')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Trim video' })).toBeEnabled();
});

test('a failed engine download shows a plain message, details on request, and can be retried', async ({
  page,
}) => {
  test.setTimeout(120_000);
  await page.route('**/assets/**', (route) => route.abort('connectionreset'));
  await page.goto('/tools/convert-to-mp4/');
  await page.locator('input[type="file"]').setInputFiles('tests/fixtures/clip.mov');

  const panel = page.getByTestId('error-panel');
  await expect(panel).toContainText('could not finish downloading', { timeout: 60_000 });
  await expect(panel).toContainText('Check your connection');
  // The technical detail stays out of the way until asked for.
  await expect(panel.locator('pre')).toBeHidden();
  await panel.getByText('Details').click();
  await expect(panel.locator('pre')).toContainText('ffmpeg-core.wasm');

  // Connection back: Try again recovers without reloading the page.
  await page.unroute('**/assets/**');
  await panel.getByRole('button', { name: 'Try again' }).click();
  await expect(page.getByTestId('convert-tool')).toBeVisible({ timeout: 90_000 });
});
