import { expect, test } from '@playwright/test';
import { callEngine, fixture, openEngine } from './support/engine';

test('a real encode reports progress, can be cancelled, and the next job still works', async ({
  page,
}) => {
  test.setTimeout(240_000);
  await openEngine(page);

  const result = await callEngine(page, 'runnerCheck', fixture('long-lowres.mp4'));

  // Progress arrives during the run, only moves forward, and ends at exactly 1.
  // At least two in-progress updates plus the final 1.
  expect(result.progress.length).toBeGreaterThanOrEqual(3);
  expect(result.progress).toEqual([...result.progress].sort((a, b) => a - b));
  expect(result.progress.at(-1)).toBe(1);
  expect(result.progress.at(-2)).toBeLessThan(1);
  expect(result.outputBytes).toBeGreaterThan(10_000);

  // Cancelling stops the job part-way with a clean "cancelled" error.
  expect(result.cancelledWith).toBe('cancelled');
  expect(result.progressBeforeCancel).toBeGreaterThanOrEqual(0.25);
  expect(result.progressBeforeCancel).toBeLessThan(1);

  // A fresh session afterwards works normally.
  expect(result.afterCancelOutputBytes).toBeGreaterThan(5_000);
});
