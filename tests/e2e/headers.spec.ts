import { expect, test } from './support/test';
import { TOOL_PAGES, toolPath } from '../../src/seo/registry';

const TOOL_URL = toolPath('trim-video');

test.describe('cross-origin isolation', () => {
  test('tool routes are isolated', async ({ page }) => {
    const response = await page.goto(TOOL_URL);
    const headers = response?.headers() ?? {};
    expect(headers['cross-origin-opener-policy']).toBe('same-origin');
    expect(headers['cross-origin-embedder-policy']).toBe('require-corp');
    expect(await page.evaluate(() => self.crossOriginIsolated)).toBe(true);
  });

  test('the home page is not isolated', async ({ page }) => {
    const response = await page.goto('/');
    const headers = response?.headers() ?? {};
    expect(headers['cross-origin-opener-policy']).toBeUndefined();
    expect(headers['cross-origin-embedder-policy']).toBeUndefined();
    expect(await page.evaluate(() => self.crossOriginIsolated)).toBe(false);
  });
});

test('every page carries the baseline security headers', async ({ request }) => {
  for (const url of ['/', TOOL_URL]) {
    const headers = (await request.get(url)).headers();
    expect(headers['x-content-type-options'], url).toBe('nosniff');
    expect(headers['content-security-policy'], url).toContain("connect-src 'self'");
    expect(headers['content-security-policy'], url).toContain("frame-ancestors 'none'");
    expect(headers['content-security-policy'], url).toContain("object-src 'none'");
    expect(headers['x-frame-options'], url).toBe('DENY');
    expect(headers['strict-transport-security'], url).toContain('max-age=31536000');
    expect(headers['permissions-policy'], url).toContain('camera=()');
  }
});

test('all 20 tool pages are served', async ({ request }) => {
  for (const { slug } of TOOL_PAGES) {
    const response = await request.get(toolPath(slug));
    expect(response.status(), slug).toBe(200);
  }
});

// One fresh page per URL. Navigating away mid-load makes WebKit log the cancelled
// analytics request as an error, which says nothing about the page itself.
for (const url of ['/', TOOL_URL]) {
  test(`${url} loads without console or CSP errors`, async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text());
    });
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto(url);
    await page.waitForLoadState('networkidle');
    expect(errors).toEqual([]);
  });
}
