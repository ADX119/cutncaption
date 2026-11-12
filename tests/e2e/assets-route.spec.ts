import { expect, test } from '@playwright/test';

// The Worker behind /assets/* serves large binaries from R2. Object contents are
// covered by unit tests (worker/assets.test.ts); this checks the route is wired up.

test('a missing asset is a plain 404, not the site 404 page', async ({ request }) => {
  const response = await request.get('/assets/does-not-exist.wasm');
  expect(response.status()).toBe(404);
  expect(response.headers()['content-type']).toContain('text/plain');
});

test('the asset route is read-only', async ({ request }) => {
  const response = await request.post('/assets/anything.wasm', { data: 'x' });
  expect(response.status()).toBe(405);
  expect(response.headers()['allow']).toBe('GET, HEAD');
});

test('unknown pages get the site 404 page', async ({ request }) => {
  const response = await request.get('/no-such-page/');
  expect(response.status()).toBe(404);
  expect(response.headers()['content-type']).toContain('text/html');
});
