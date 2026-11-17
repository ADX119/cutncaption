import { expect, test } from '@playwright/test';
import index from '../fixtures/index.json';
import { callEngine, fixture, openEngine } from './support/engine';

test('the engine reads every fixture correctly', async ({ page }) => {
  test.setTimeout(180_000);
  await openEngine(page);

  const results = await callEngine(
    page,
    'probe',
    index.map((entry) => fixture(entry.file)),
  );

  results.forEach((result, i) => {
    const expected = index[i];
    if (!expected) throw new Error('fixture index mismatch');
    const label = expected.file;
    if ('error' in result) throw new Error(`${label}: ${result.error}`);

    expect(result.durationSec, label).toBeCloseTo(expected.durationSec, 1);
    if (expected.videoCodec) {
      expect(result.video?.codec, label).toBe(expected.videoCodec);
      expect(result.video?.width, label).toBe(expected.width);
      expect(result.video?.height, label).toBe(expected.height);
      expect(result.video?.fps, label).toBe(expected.fps);
    } else {
      expect(result.video, label).toBeNull();
    }
    if (expected.audioCodec) expect(result.audio?.codec, label).toBe(expected.audioCodec);
    else expect(result.audio, label).toBeNull();
  });

  const rotated = results[index.findIndex((entry) => entry.file === 'rotated.mp4')];
  expect(rotated).toMatchObject({ video: { displayWidth: 360, displayHeight: 640 } });
});

test('a file that is not media is refused with a clear error', async ({ page }) => {
  // Loads the engine: against the live site that is a fresh 31 MB download per test.
  test.setTimeout(120_000);
  await openEngine(page);
  const notMedia = {
    name: 'notes.mp4',
    type: 'video/mp4',
    base64: Buffer.from('this is plain text, not a video').toString('base64'),
  };
  const [result] = await callEngine(page, 'probe', [notMedia]);
  expect(result).toEqual({ error: expect.stringContaining('unreadable-file') });
});
