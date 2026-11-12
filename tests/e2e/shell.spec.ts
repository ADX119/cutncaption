import { expect, test } from '@playwright/test';

test('home shows the header, headline and privacy footer', async ({ page }) => {
  await page.goto('/');
  await expect(
    page.getByRole('banner').getByRole('link', { name: 'cutncaption home' }),
  ).toBeVisible();
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(page.getByRole('contentinfo')).toContainText('never uploaded');
});

test('header links cross the isolation boundary with a full page load', async ({ page }) => {
  await page.goto('/');
  expect(await page.evaluate(() => self.crossOriginIsolated)).toBe(false);

  // A client-side route change would keep the home document, which is not isolated.
  await page.getByRole('navigation', { name: 'Tools' }).getByRole('link', { name: 'Trim' }).click();
  await page.waitForURL('**/tools/trim-video/');
  expect(await page.evaluate(() => self.crossOriginIsolated)).toBe(true);

  await page.getByRole('link', { name: 'cutncaption home' }).click();
  await page.waitForURL((url) => url.pathname === '/');
  expect(await page.evaluate(() => self.crossOriginIsolated)).toBe(false);
});

test('the theme toggle switches, and the choice survives a reload', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto('/');
  const background = () => page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  await expect.poll(background).toBe('rgb(245, 246, 243)');

  await page.getByRole('button', { name: /light and dark/ }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect.poll(background).toBe('rgb(16, 20, 18)');

  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect.poll(background).toBe('rgb(16, 20, 18)');
});

test('follows the system theme when no choice is stored', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('/');
  await expect(page.locator('html')).not.toHaveAttribute('data-theme');
  await expect
    .poll(() => page.evaluate(() => getComputedStyle(document.body).backgroundColor))
    .toBe('rgb(16, 20, 18)');
});

test('pages do not scroll sideways', async ({ page }) => {
  for (const url of ['/', '/tools/trim-video/']) {
    await page.goto(url);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow, url).toBeLessThanOrEqual(0);
  }
});
