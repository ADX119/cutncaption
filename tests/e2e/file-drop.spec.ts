import fs from 'node:fs';
import path from 'node:path';
import { expect, test } from '@playwright/test';

const TOOL_URL = '/tools/trim-video/';
const fixture = (name: string) => fs.readFileSync(path.join('tests', 'fixtures', name));

test('a chosen video is read by the engine, and it can be swapped', async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto(TOOL_URL);

  await page.locator('input[type="file"]').setInputFiles({
    name: 'holiday clip.mp4',
    mimeType: 'video/mp4',
    buffer: fixture('landscape-720p.mp4'),
  });
  const summary = page.getByTestId('file-summary');
  await expect(summary).toContainText('holiday clip.mp4', { timeout: 90_000 });
  await expect(summary).toContainText('0:05 · 1280 × 720 · 95 KB');

  await page.getByRole('button', { name: 'Choose another file' }).click();
  await expect(page.getByTestId('file-drop')).toBeVisible();
});

test('a rotated phone video is described the way it is seen', async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto(TOOL_URL);
  await page.locator('input[type="file"]').setInputFiles({
    name: 'portrait.mp4',
    mimeType: 'video/mp4',
    buffer: fixture('rotated.mp4'),
  });
  await expect(page.getByTestId('file-summary')).toContainText('360 × 640', { timeout: 90_000 });
});

test('a file that only looks like a video gets a clear error and can be retried', async ({
  page,
}) => {
  test.setTimeout(120_000);
  await page.goto(TOOL_URL);
  await page.locator('input[type="file"]').setInputFiles({
    name: 'fake.mp4',
    mimeType: 'video/mp4',
    buffer: Buffer.alloc(64 * 1024, 1),
  });
  const panel = page.getByTestId('error-panel');
  await expect(panel).toContainText('could not be read', { timeout: 90_000 });
  await panel.getByRole('button', { name: 'Start over' }).click();
  await expect(page.getByTestId('file-drop')).toBeVisible();
});

test('an unsupported file is refused with a reason', async ({ page }) => {
  await page.goto(TOOL_URL);
  await page.locator('input[type="file"]').setInputFiles({
    name: 'notes.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('hello'),
  });
  // Scoped to the drop zone: Next renders its own hidden role="alert" route announcer.
  await expect(page.getByTestId('file-drop').getByRole('alert')).toContainText('supported');
  await expect(page.getByTestId('file-summary')).toHaveCount(0);
});

test('the picker button is reachable by keyboard', async ({ page }) => {
  await page.goto(TOOL_URL);
  const button = page.getByRole('button', { name: 'Choose a file' });
  // The button exists in the static HTML before React attaches its handler, so a key
  // press can land too early. Retry until the page is interactive.
  await expect(async () => {
    await button.focus();
    const chooser = page.waitForEvent('filechooser', { timeout: 2_000 });
    await page.keyboard.press('Enter');
    expect((await chooser).isMultiple()).toBe(false);
  }).toPass({ timeout: 20_000 });
});
