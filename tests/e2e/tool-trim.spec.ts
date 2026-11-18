import { downloadAndProbe, expectPlayable, openToolWith, setTime } from './support/tools';
import { expect, test } from './support/test';

const URL = '/tools/trim-video/';

test('a precise trim cuts exactly the chosen two seconds', async ({ page, browserName }) => {
  test.setTimeout(180_000);
  await openToolWith(page, URL, 'landscape-720p.mp4', 'trim-tool');

  await setTime(page, 'Start', '1');
  await setTime(page, 'End', '3');
  await expect(page.getByTestId('timeline-readout')).toContainText('0:02.0 selected');
  await page.getByRole('button', { name: 'Trim video' }).click();

  const result = await downloadAndProbe(page);
  expect(result.filename).toBe('landscape-720p-trimmed.mp4');
  expect(result.info.durationSec).toBeGreaterThan(1.9);
  expect(result.info.durationSec).toBeLessThan(2.1);
  expect(result.info.video).toMatchObject({ codec: 'h264', width: 1280, height: 720 });
  expect(result.info.audio?.codec).toBe('aac');
  await expectPlayable(page, browserName);
});

test('a fast trim keeps the original format and plays', async ({ page, browserName }) => {
  test.setTimeout(180_000);
  await openToolWith(page, URL, 'clip.webm', 'trim-tool');

  await setTime(page, 'Start', '1');
  await setTime(page, 'End', '2.5');
  await page.getByText('Fast', { exact: true }).click();
  await expect(page.getByText(/nearest keyframe/)).toBeVisible();
  await page.getByRole('button', { name: 'Trim video' }).click();

  const result = await downloadAndProbe(page);
  expect(result.filename).toBe('clip-trimmed.webm');
  // A copy, not a re-encode: the codecs are untouched.
  expect(result.info.video?.codec).toBe('vp9');
  expect(result.info.audio?.codec).toBe('opus');
  // Cuts land on keyframes, so allow some slack around the chosen 1.5 s.
  expect(result.info.durationSec).toBeGreaterThan(0.9);
  expect(result.info.durationSec).toBeLessThan(2.6);
  await expectPlayable(page, browserName);
});

test('the start can be set from the keyboard on the timeline', async ({ page }) => {
  test.setTimeout(120_000);
  await openToolWith(page, URL, 'landscape-720p.mp4', 'trim-tool');

  await page.getByRole('slider', { name: 'Start of selection' }).focus();
  await page.keyboard.press('Shift+ArrowRight');
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('slider', { name: 'Start of selection' })).toHaveAttribute(
    'aria-valuetext',
    '0:01.1',
  );
  await expect(page.getByRole('textbox', { name: 'Start', exact: true })).toHaveValue('0:01.1');
});

test('a running trim can be cancelled and the tool comes back', async ({ page }) => {
  test.setTimeout(180_000);
  await openToolWith(page, URL, 'long-lowres.mp4', 'trim-tool');
  await page.getByRole('button', { name: 'Trim video' }).click();
  await expect(page.getByTestId('job-progress')).toBeVisible();
  await page.getByRole('button', { name: 'Cancel' }).click();
  await expect(page.getByTestId('trim-tool')).toBeVisible({ timeout: 30_000 });
});
