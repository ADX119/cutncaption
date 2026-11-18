import fs from 'node:fs';
import path from 'node:path';
import { downloadAndProbe, expectPlayable, openToolWith } from './support/tools';
import { expect, test } from './support/test';

const URL = '/tools/compress-video/';
const HQ_BYTES = fs.statSync(path.join('tests', 'fixtures', 'hq-1080p.mp4')).size;

test('Balanced turns a 1080p clip into a much smaller 720p MP4', async ({ page, browserName }) => {
  test.setTimeout(180_000);
  await openToolWith(page, URL, 'hq-1080p.mp4', 'compress-tool');

  // Balanced is the default, and an estimate is shown before running.
  await expect(page.getByRole('radio', { name: 'Balanced' })).toBeChecked();
  await expect(page.getByTestId('compress-estimate')).toContainText(/About .+ from 214 KB/);
  await page.getByRole('button', { name: 'Compress video' }).click();

  const result = await downloadAndProbe(page);
  expect(result.filename).toBe('hq-1080p-compressed.mp4');
  expect(result.info.video).toMatchObject({ codec: 'h264', width: 1280, height: 720 });
  expect(result.info.audio?.codec).toBe('aac');
  expect(result.bytes).toBeLessThan(HQ_BYTES * 0.5);
  await expect(page.getByTestId('result-size')).toContainText('smaller');
  await expectPlayable(page, browserName);
});

test('Small caps a 1080p clip at 480p', async ({ page }) => {
  test.setTimeout(180_000);
  await openToolWith(page, URL, 'hq-1080p.mp4', 'compress-tool');
  await page.getByText('Small', { exact: true }).click();
  await expect(page.getByText(/messaging apps/)).toBeVisible();
  await page.getByRole('button', { name: 'Compress video' }).click();

  const result = await downloadAndProbe(page);
  expect(result.info.video).toMatchObject({ width: 854, height: 480 });
});

test('a clip that will not shrink is called out, and the original is offered', async ({ page }) => {
  test.setTimeout(180_000);
  // Already heavily compressed: re-encoding at Light only makes it bigger.
  await openToolWith(page, URL, 'landscape-720p.mp4', 'compress-tool');
  await page.getByText('Light', { exact: true }).click();
  await expect(page.getByTestId('compress-small-already')).toBeVisible();
  await page.getByRole('button', { name: 'Compress video' }).click();

  const panel = page.getByTestId('not-smaller');
  await expect(panel).toBeVisible({ timeout: 120_000 });
  await expect(panel.getByRole('link', { name: 'Keep original' })).toHaveAttribute(
    'download',
    'landscape-720p.mp4',
  );
  await panel.getByRole('button', { name: 'Try Small' }).click();
  await expect(page.getByRole('radio', { name: 'Small' })).toBeChecked();
});
