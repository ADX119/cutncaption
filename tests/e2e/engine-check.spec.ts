import { type Page, expect, test } from '@playwright/test';

const URL = '/tools/engine-check/';

/** Starts the check (retrying until the page is interactive) and waits for an outcome. */
async function runCheck(page: Page) {
  const run = page.getByRole('button', { name: 'Run the check' });
  const started = page
    .getByRole('button', { name: 'Checking…' })
    .or(page.getByTestId('engine-result'))
    .or(page.getByTestId('engine-error'));

  await expect(async () => {
    if (await run.isVisible()) await run.click();
    await expect(started.first()).toBeVisible({ timeout: 1_000 });
  }).toPass({ timeout: 20_000 });

  const outcome = page.getByTestId('engine-result').or(page.getByTestId('engine-error'));
  await expect(outcome.first()).toBeVisible({ timeout: 90_000 });
  // Surface the engine's own error text if it failed.
  await expect(page.getByTestId('engine-error')).toHaveCount(0);
}

test('ffmpeg loads and runs a command, and the second visit needs no download', async ({
  page,
  browserName,
}) => {
  test.setTimeout(180_000);
  // Playwright's WebKit drops Cache Storage on every page load (even a 1 MB entry
  // put a moment earlier is gone after a reload), so the second-visit cache cannot
  // be tested there. Real Safari is covered by the device checklist in TASKS M5.14.
  const cachePersists = browserName !== 'webkit';
  const wasmDownloads: string[] = [];
  page.on('request', (request) => {
    const url = request.url();
    if (url.includes('/assets/') && url.endsWith('.wasm')) wasmDownloads.push(url);
  });

  await page.goto(URL);
  await runCheck(page);
  await expect(page.getByTestId('engine-version')).toHaveText(/\d+\.\d+/);
  await expect(page.getByTestId('engine-from-cache')).toHaveText('No');
  await expect(page.getByTestId('engine-isolated')).toHaveText('Yes');
  expect(wasmDownloads).toHaveLength(1);

  wasmDownloads.length = 0;
  await page.reload();
  await runCheck(page);
  await expect(page.getByTestId('engine-version')).toHaveText(/\d+\.\d+/);
  if (cachePersists) {
    await expect(page.getByTestId('engine-from-cache')).toHaveText('Yes');
    expect(wasmDownloads).toHaveLength(0);
  }
});

test('the engine can be loaded again after it was shut down', async ({ page }) => {
  test.setTimeout(180_000);
  await page.goto(URL);
  await runCheck(page);
  await runCheck(page);
  await expect(page.getByTestId('engine-version')).toHaveText(/\d+\.\d+/);
});

test('the diagnostics page is kept out of search results', async ({ page }) => {
  await page.goto(URL);
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
});
