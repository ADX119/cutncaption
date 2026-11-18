import { callEngine, fixture, openEngine } from './support/engine';
import { expect, test } from './support/test';

const KB = 1024;

test('compress to size lands under the target and close to it', async ({ page }) => {
  test.setTimeout(180_000);
  await openEngine(page);

  // The 1080p clip is 214 KB; ask for 150 KB.
  const target = 150 * KB;
  const result = await callEngine(page, 'engineJob', fixture('hq-1080p.mp4'), {
    kind: 'compressToSize',
    targetBytes: target,
  });

  expect(result.bytes).toBeLessThanOrEqual(target);
  expect(result.bytes).toBeGreaterThanOrEqual(target * 0.85);
  expect(result.output.video?.codec).toBe('h264');
  // ~1 Mbps of video can carry 480p (bitrate ladder).
  expect(result.output.video).toMatchObject({ width: 854, height: 480 });
});

test('a target the file is already under is refused', async ({ page }) => {
  test.setTimeout(120_000);
  await openEngine(page);
  const run = callEngine(page, 'engineJob', fixture('landscape-720p.mp4'), {
    kind: 'compressToSize',
    targetBytes: 500 * KB,
  });
  await expect(run).rejects.toThrow(/already-under-target/);
});
