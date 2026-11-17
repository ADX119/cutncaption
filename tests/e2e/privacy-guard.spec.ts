import { expect, test } from './support/test';

// Proves the guard works: each of these does something the guard must catch, and is
// marked as expected to fail. If the guard ever stops catching it, the test passes
// unexpectedly and the suite fails.

test('the guard fails a test that uploads a file to our own site', async ({ page }) => {
  test.fail();
  await page.route('**/api/upload', (route) => route.fulfill({ status: 204 }));
  await page.goto('/');
  await page.evaluate(() =>
    fetch('/api/upload', { method: 'POST', body: new Blob([new Uint8Array(64 * 1024)]) }),
  );
});

test('the guard fails a test that contacts another host', async ({ page }) => {
  test.fail();
  await page.route('https://example.com/**', (route) => route.fulfill({ status: 204 }));
  await page.goto('/');
  await page.evaluate(() => fetch('https://example.com/ping', { mode: 'no-cors' }));
});

test('the guard stays quiet for a normal visit', async ({ page, privacyGuard }) => {
  await page.goto('/');
  await page.goto('/tools/trim-video/');
  expect(privacyGuard).toEqual([]);
});
