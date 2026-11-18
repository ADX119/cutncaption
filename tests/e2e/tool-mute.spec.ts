import { downloadAndProbe, expectPlayable, openToolWith } from './support/tools';
import { expect, test } from './support/test';

const URL = '/tools/mute-video/';

test('the sound is removed and the picture is copied untouched', async ({ page, browserName }) => {
  test.setTimeout(180_000);
  await openToolWith(page, URL, 'landscape-720p.mp4', 'mute-tool');
  await page.getByRole('button', { name: 'Remove sound' }).click();

  const result = await downloadAndProbe(page);
  expect(result.filename).toBe('landscape-720p-muted.mp4');
  expect(result.info.audio).toBeNull();
  expect(result.info.video).toMatchObject({ codec: 'h264', width: 1280, height: 720 });
  expect(result.info.durationSec).toBeCloseTo(5, 0);
  await expectPlayable(page, browserName);
});

test('a WebM stays a WebM', async ({ page }) => {
  test.setTimeout(180_000);
  await openToolWith(page, URL, 'clip.webm', 'mute-tool');
  await page.getByRole('button', { name: 'Remove sound' }).click();
  const result = await downloadAndProbe(page);
  expect(result.filename).toBe('clip-muted.webm');
  expect(result.info.video?.codec).toBe('vp9');
  expect(result.info.audio).toBeNull();
});

test('a video that is already silent is called out', async ({ page }) => {
  test.setTimeout(120_000);
  await openToolWith(page, URL, 'no-audio.mp4', 'mute-tool');
  await expect(page.getByTestId('tool-refusal')).toContainText('already has no sound');
  await expect(page.getByRole('button', { name: 'Remove sound' })).toBeDisabled();
});
