import { expect, test } from '@playwright/test';
import { callEngine, fixture, openEngine } from './support/engine';

test('an H.264/AAC MOV is converted to MP4 by stream copy', async ({ page }) => {
  test.setTimeout(120_000);
  await openEngine(page);

  const result = await callEngine(page, 'engineRun', fixture('clip.mov'));

  expect(result.path).toBe('copy');
  expect(result.filename).toBe('clip-converted.mp4');
  expect(result.mime).toBe('video/mp4');
  expect(result.output.container).toContain('mp4');
  expect(result.output.video).toMatchObject({ codec: 'h264', width: 640, height: 360 });
  expect(result.output.audio?.codec).toBe('aac');
  expect(result.output.durationSec).toBeCloseTo(3, 0);
});

test('a VP9/Opus WebM is re-encoded to an H.264/AAC MP4', async ({ page }, info) => {
  test.setTimeout(180_000);
  await openEngine(page);

  const result = await callEngine(page, 'engineRun', fixture('clip.webm'));

  // iPhone emulation picks the single-thread core; everything else here picks multi-thread.
  expect(result.path).toBe(info.project.name === 'iphone' ? 'ffmpeg-st' : 'ffmpeg-mt');
  expect(result.fellBack).toBe(false);
  expect(result.progressCount).toBeGreaterThan(0);
  expect(result.output.video).toMatchObject({ codec: 'h264', width: 640, height: 360 });
  expect(result.output.audio?.codec).toBe('aac');
  expect(result.output.durationSec).toBeCloseTo(3, 0);
});
