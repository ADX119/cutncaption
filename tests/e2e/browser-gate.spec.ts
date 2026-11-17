import { expect, test } from './support/test';

const TOOL_URL = '/tools/trim-video/';

test.describe('in-app browser', () => {
  test.use({
    userAgent:
      'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 350.0.0.0',
  });

  test('is told to open the page in a real browser', async ({ page }) => {
    await page.goto(TOOL_URL);
    const notice = page.getByTestId('browser-notice');
    await expect(notice.getByRole('heading')).toHaveText('Open this page in your browser');
    await expect(notice).toContainText('Instagram');
    await expect(notice).toContainText(TOOL_URL);
    await expect(notice.getByRole('button', { name: 'Copy link' })).toBeVisible();
    await expect(page.getByTestId('file-drop')).toHaveCount(0);
  });

  test('can still read the rest of the site', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.getByTestId('browser-notice')).toHaveCount(0);
  });
});

test('a browser missing a required feature is told what is missing', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'caches', { value: undefined, configurable: true });
  });
  await page.goto(TOOL_URL);
  const notice = page.getByTestId('browser-notice');
  await expect(notice.getByRole('heading')).toHaveText('This browser cannot run the tools');
  await expect(notice).toContainText('file caching');
  await expect(page.getByTestId('file-drop')).toHaveCount(0);
});

test('a supported browser gets the tool', async ({ page }) => {
  await page.goto(TOOL_URL);
  await expect(page.getByTestId('file-drop')).toBeVisible();
  await expect(page.getByTestId('browser-notice')).toHaveCount(0);
});
