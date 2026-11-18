import { downloadAndProbe, openToolWith } from './support/tools';
import { expect, test } from './support/test';

test('the WhatsApp page starts on the WhatsApp preset and spots a file already under it', async ({
  page,
}) => {
  test.setTimeout(120_000);
  await openToolWith(
    page,
    '/tools/compress-video-for-whatsapp/',
    'landscape-720p.mp4',
    'size-tool',
  );

  await expect(page.getByRole('radio', { name: 'WhatsApp' })).toBeChecked();
  await expect(page.getByText(/Under 16 MB, the size WhatsApp accepts/)).toBeVisible();
  await expect(page.getByTestId('size-plan')).toContainText('already under that size');
  await expect(page.getByRole('button', { name: 'Compress video' })).toBeDisabled();
});

test('the Discord page uses the 20 MB limit', async ({ page }) => {
  test.setTimeout(120_000);
  await openToolWith(page, '/tools/compress-video-for-discord/', 'landscape-720p.mp4', 'size-tool');
  await expect(page.getByRole('radio', { name: 'Discord' })).toBeChecked();
  await expect(page.getByText(/Under 20 MB/)).toBeVisible();
});

test('a custom size shrinks the video to fit under it', async ({ page }) => {
  test.setTimeout(180_000);
  await openToolWith(page, '/tools/compress-video-to-size/', 'hq-1080p.mp4', 'size-tool');

  await expect(page.getByRole('radio', { name: 'Custom' })).toBeChecked();
  await page.getByRole('textbox', { name: 'Size in MB' }).fill('0.15');
  await expect(page.getByTestId('size-plan')).toContainText('Under 142 KB');
  await page.getByRole('button', { name: 'Compress video' }).click();

  const result = await downloadAndProbe(page);
  // 0.15 MB less the 3% safety margin.
  expect(result.bytes).toBeLessThanOrEqual(145_500);
  expect(result.info.video?.codec).toBe('h264');
});

test('a size too small to watch offers the smallest that works', async ({ page }) => {
  test.setTimeout(120_000);
  await openToolWith(page, '/tools/compress-video-to-size/', 'hq-1080p.mp4', 'size-tool');

  await page.getByRole('textbox', { name: 'Size in MB' }).fill('0.01');
  const plan = page.getByTestId('size-plan');
  await expect(plan).toContainText('too small for this video to stay watchable');
  await expect(page.getByRole('button', { name: 'Compress video' })).toBeDisabled();

  await plan.getByRole('button', { name: 'Use the smallest size' }).click();
  await expect(plan).toContainText('Under');
  await expect(page.getByRole('button', { name: 'Compress video' })).toBeEnabled();
});
