import { downloadAndProbe, expectPlayable, openToolWith } from './support/tools';
import { expect, test } from './support/test';

const URL = '/tools/convert-to-mp4/';

test('a WebM is converted to an H.264/AAC MP4', async ({ page, browserName }) => {
  test.setTimeout(180_000);
  await openToolWith(page, URL, 'clip.webm', 'convert-tool');
  await expect(page.getByTestId('tool-explain')).toContainText('converted to H.264 MP4');
  await page.getByRole('button', { name: 'Convert to MP4' }).click();

  const result = await downloadAndProbe(page);
  expect(result.filename).toBe('clip-converted.mp4');
  expect(result.info.container).toContain('mp4');
  expect(result.info.video).toMatchObject({ codec: 'h264', width: 640, height: 360 });
  expect(result.info.audio?.codec).toBe('aac');
  await expectPlayable(page, browserName);
});

test('an MP4 that is already H.264 is repackaged at once, without re-encoding', async ({
  page,
}) => {
  test.setTimeout(180_000);
  await openToolWith(page, URL, 'landscape-720p.mp4', 'convert-tool');
  await expect(page.getByTestId('tool-explain')).toContainText('repackaged as MP4 at once');
  await page.getByRole('button', { name: 'Convert to MP4' }).click();

  const result = await downloadAndProbe(page);
  // A copy keeps the original stream byte for byte, so the size barely moves.
  expect(result.info.video).toMatchObject({ codec: 'h264', width: 1280, height: 720 });
  expect(Math.abs(result.bytes - 97_245)).toBeLessThan(5_000);
});

for (const fixture of ['clip.mov', 'clip.mkv', 'clip.avi'] as const) {
  test(`${fixture} converts to a playable MP4`, async ({ page, browserName }) => {
    test.setTimeout(180_000);
    await openToolWith(page, '/tools/mov-to-mp4/', fixture, 'convert-tool');
    await page.getByRole('button', { name: 'Convert to MP4' }).click();
    const result = await downloadAndProbe(page);
    expect(result.info.container).toContain('mp4');
    expect(result.info.video?.codec).toBe('h264');
    expect(result.info.audio?.codec).toBe('aac');
    await expectPlayable(page, browserName);
  });
}
