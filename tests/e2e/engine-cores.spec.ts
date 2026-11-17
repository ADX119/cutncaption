import { expect, test } from './support/test';
import { callEngine, fixture, openEngine } from './support/engine';

test('both ffmpeg cores encode; report timings and the selection', async ({ page }, info) => {
  test.setTimeout(300_000);
  await openEngine(page);

  const result = await callEngine(page, 'coreCheck', fixture('long-lowres.mp4'), ['st', 'mt']);
  // Visible in the test report, so the speed difference can be compared per browser.
  info.annotations.push({ type: 'cores', description: JSON.stringify(result) });
  console.log(info.project.name, JSON.stringify(result));

  const st = result.results.find((r) => r.variant === 'st');
  const mt = result.results.find((r) => r.variant === 'mt');
  expect(st?.ok, st?.error).toBe(true);
  expect(st?.outputBytes).toBeGreaterThan(10_000);

  // Wherever this browser would pick the multi-thread core, it must work there.
  if (result.selected === 'mt') {
    expect(mt?.ok, mt?.error).toBe(true);
    expect(mt?.outputBytes).toBeGreaterThan(10_000);
  }
});
