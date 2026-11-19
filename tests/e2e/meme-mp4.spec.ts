import { callEngine, fixture, openEngine } from './support/engine';
import { expect, test } from './support/test';

test('top and bottom text to MP4: the moment, with the caption burned into the boxes', async ({
  page,
}) => {
  test.setTimeout(180_000);
  await openEngine(page);
  const check = await callEngine(
    page,
    'memeFrameCheck',
    fixture('landscape-720p.mp4'),
    {
      start: 1,
      end: 4,
      layout: 'top-bottom',
      text: { top: 'when the export', bottom: 'matches the preview' },
      textScale: 1,
      format: 'mp4',
    },
    1,
  );

  expect(check.filename).toBe('landscape-720p-meme.mp4');
  expect(check.output.video).toMatchObject({
    codec: 'h264',
    displayWidth: 1280,
    displayHeight: 720,
  });
  expect(check.output.audio?.codec).toBe('aac');
  // The output is exactly the selected moment.
  expect(check.output.durationSec).toBeGreaterThan(2.9);
  expect(check.output.durationSec).toBeLessThan(3.15);

  // At 1 s the text boxes differ clearly from the source; the rest of the picture is
  // the source again, apart from compression noise.
  expect(check.diffInside).toBeGreaterThan(15);
  expect(check.diffOutside).toBeLessThan(6);
  expect(check.diffInside).toBeGreaterThan(check.diffOutside * 4);
});

test('a silent clip makes a silent meme', async ({ page }) => {
  test.setTimeout(180_000);
  await openEngine(page);
  const check = await callEngine(
    page,
    'memeFrameCheck',
    fixture('no-audio.mp4'),
    {
      start: 0,
      end: 2,
      layout: 'top-bottom',
      text: { top: '', bottom: 'no sound here' },
      textScale: 1,
      format: 'mp4',
    },
    1,
  );
  expect(check.output.audio).toBeNull();
  expect(check.output.video).toMatchObject({ displayWidth: 640, displayHeight: 360 });
  expect(check.diffInside).toBeGreaterThan(check.diffOutside * 4);
});
