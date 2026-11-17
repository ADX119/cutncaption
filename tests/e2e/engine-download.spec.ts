import fs from 'node:fs';
import path from 'node:path';
import { type Page, expect, test } from '@playwright/test';

const TOOL_URL = '/tools/trim-video/';
const clip = fs.readFileSync(path.join('tests', 'fixtures', 'clip.mov'));

/** Slows engine downloads so the progress panel is on screen long enough to see. */
async function slowEngineDownloads(page: Page) {
  await page.route('**/assets/**', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 1500));
    await route.continue();
  });
}

/** Records whether the download panel ever appears, however briefly. */
async function watchForPanel(page: Page) {
  await page.evaluate(() => {
    const seen = { panel: false };
    Object.assign(window, { __panelSeen: seen });
    new MutationObserver(() => {
      if (document.querySelector('[data-testid="engine-download"]')) seen.panel = true;
    }).observe(document.body, { childList: true, subtree: true });
  });
}

async function chooseClip(page: Page) {
  await page.locator('input[type="file"]').setInputFiles({
    name: 'clip.mov',
    mimeType: 'video/quicktime',
    buffer: clip,
  });
  await expect(page.getByTestId('file-summary')).toBeVisible({ timeout: 90_000 });
}

test('the first visit shows the engine download with its size; the next does not', async ({
  page,
  browserName,
}) => {
  test.setTimeout(180_000);
  await slowEngineDownloads(page);

  // First visit: nothing is downloaded until a file is chosen, then progress shows.
  await page.goto(TOOL_URL);
  const panel = page.getByTestId('engine-download');
  await page.locator('input[type="file"]').setInputFiles({
    name: 'clip.mov',
    mimeType: 'video/quicktime',
    buffer: clip,
  });
  await expect(panel).toBeVisible();
  await expect(panel).toContainText('Getting the editor ready');
  await expect(panel).toContainText(/of \d+\.\d MB/);
  await expect(page.getByTestId('file-summary')).toBeVisible({ timeout: 90_000 });
  await expect(panel).toHaveCount(0);

  // Playwright's WebKit drops Cache Storage on reload, so it always downloads again.
  test.skip(browserName === 'webkit', 'WebKit test browser does not keep Cache Storage');

  await page.reload();
  await watchForPanel(page);
  await chooseClip(page);
  expect(
    await page.evaluate(
      () => (window as unknown as { __panelSeen: { panel: boolean } }).__panelSeen.panel,
    ),
  ).toBe(false);
});

test('nothing is downloaded before a file is chosen on a first visit', async ({ page }) => {
  const wasm: string[] = [];
  page.on('request', (request) => {
    if (request.url().endsWith('.wasm')) wasm.push(request.url());
  });
  await page.goto(TOOL_URL);
  await page.waitForLoadState('networkidle');
  // Give an idle-time pre-warm the chance to (wrongly) start.
  await page.waitForTimeout(3500);
  expect(wasm).toEqual([]);
});
