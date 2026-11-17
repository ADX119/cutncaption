import { expect, test } from './support/test';
import { callEngine, fixture, openEngine } from './support/engine';

test('a mounted input is processed and nothing is left behind, even on error', async ({ page }) => {
  test.setTimeout(120_000);
  await openEngine(page);
  const input = fixture('landscape-720p.mp4');

  const result = await callEngine(page, 'workspaceCheck', input);

  // Stream copy of a 97 KB clip: the output is a real MP4 of about the same size.
  expect(result.outputType).toBe('video/mp4');
  expect(result.outputBytes).toBeGreaterThan(50_000);
  expect(result.leftoversAfterSuccess).toEqual([]);
  expect(result.errorMessage).toBe('simulated failure');
  expect(result.leftoversAfterError).toEqual([]);
});
