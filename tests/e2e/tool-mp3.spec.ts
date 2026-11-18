import { downloadAndProbe, expectPlayable, openToolWith } from './support/tools';
import { expect, test } from './support/test';

const URL = '/tools/video-to-mp3/';

test('the sound of a video is saved as an MP3 of the same length', async ({
  page,
  browserName,
}) => {
  test.setTimeout(180_000);
  await openToolWith(page, URL, 'landscape-720p.mp4', 'mp3-tool');
  await expect(page.getByRole('radio', { name: 'High' })).toBeChecked();
  await page.getByRole('button', { name: 'Save as MP3' }).click();

  const result = await downloadAndProbe(page);
  expect(result.filename).toBe('landscape-720p-audio.mp3');
  expect(result.info.video).toBeNull();
  expect(result.info.audio?.codec).toBe('mp3');
  expect(result.info.durationSec).toBeGreaterThan(4.9);
  expect(result.info.durationSec).toBeLessThan(5.15);
  await expectPlayable(page, browserName);
});

test('the chosen quality changes the file size', async ({ page }) => {
  test.setTimeout(180_000);
  await openToolWith(page, URL, 'long-lowres.mp4', 'mp3-tool');
  await page.getByText('Standard', { exact: true }).click();
  await page.getByRole('button', { name: 'Save as MP3' }).click();
  const result = await downloadAndProbe(page);
  // 128 kbps for 60 s is about 960 KB.
  expect(result.bytes).toBeGreaterThan(900_000);
  expect(result.bytes).toBeLessThan(1_020_000);
});

test('a video with no sound is refused before anything runs', async ({ page }) => {
  test.setTimeout(120_000);
  await openToolWith(page, URL, 'no-audio.mp4', 'mp3-tool');
  await expect(page.getByTestId('tool-refusal')).toContainText('no sound');
  await expect(page.getByRole('button', { name: 'Save as MP3' })).toBeDisabled();
});
