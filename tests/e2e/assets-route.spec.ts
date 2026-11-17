import { createHash } from 'node:crypto';
import { expect, test } from '@playwright/test';
import manifest from '../../src/engine/assets/manifest.json';

// The Worker behind /assets/* serves large binaries from R2. Object contents are
// covered by unit tests (worker/assets.test.ts); this checks the route is wired up.

test('every engine file in the manifest is served intact', async ({ request }) => {
  // About 62 MB in total; against the live site this is a real internet download.
  test.setTimeout(120_000);
  for (const [key, expected] of Object.entries(manifest)) {
    const response = await request.get(`/assets/${key}`);
    expect(response.status(), key).toBe(200);
    expect(response.headers()['content-type'], key).toBe('application/wasm');
    expect(response.headers()['cache-control'], key).toContain('immutable');
    expect(response.headers()['cross-origin-resource-policy'], key).toBe('same-origin');

    const body = await response.body();
    expect(body.length, key).toBe(expected.bytes);
    expect(createHash('sha256').update(body).digest('hex'), key).toBe(expected.sha256);
  }
});

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
