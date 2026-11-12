import { expect, test } from '@playwright/test';

// Runs only against a deployed site (E2E_BASE_URL). Local and CI builds carry no
// analytics token, so they never contact Cloudflare.
test.skip(!process.env.E2E_BASE_URL, 'needs a deployed site with analytics configured');

for (const url of ['/', '/tools/trim-video/']) {
  test(`analytics loads and reports from ${url}`, async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text());
    });

    const script = page.waitForResponse((r) => r.url().includes('/beacon.min.js'));
    const report = page.waitForResponse((r) => r.url().includes('/cdn-cgi/rum'));
    await page.goto(url);

    expect((await script).ok()).toBe(true);
    // On the isolated tool route a blocked script or a rejected report would show here.
    expect((await report).ok()).toBe(true);
    expect(errors).toEqual([]);
  });
}
