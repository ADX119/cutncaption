import { expect, test } from '@playwright/test';

const TOOL_URL = '/tools/trim-video/';

test('choosing a file shows its name and size, and it can be swapped', async ({ page }) => {
  await page.goto(TOOL_URL);
  const input = page.locator('input[type="file"]');

  await input.setInputFiles({
    name: 'holiday clip.mp4',
    mimeType: 'video/mp4',
    buffer: Buffer.alloc(1.5 * 1024 * 1024, 1),
  });
  const summary = page.getByTestId('file-summary');
  await expect(summary).toContainText('holiday clip.mp4');
  await expect(summary).toContainText('1.5 MB');

  await page.getByRole('button', { name: 'Choose another file' }).click();
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
