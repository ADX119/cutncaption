import { expect, test } from '@playwright/test';

const URL = '/preview/job-states/';

test('Download saves the result under its name', async ({ page }) => {
  await page.goto(URL);
  const card = page.getByTestId('result-card');
  await expect(card.getByRole('link', { name: 'Download' })).toBeVisible();

  const download = page.waitForEvent('download');
  await card.getByRole('link', { name: 'Download' }).click();
  const file = await download;

  expect(file.suggestedFilename()).toBe('holiday clip-audio.wav');
  const saved = await file.path();
  expect(saved).toBeTruthy();
});

test('every job state renders, and the error detail stays hidden until asked for', async ({
  page,
}) => {
  await page.goto(URL);
  await expect(page.getByTestId('job-progress')).toHaveCount(2);
  await expect(page.getByRole('progressbar').first()).toHaveAttribute('aria-valuenow', '43');
  await expect(page.getByTestId('result-size')).toContainText('67% smaller');

  const panel = page.getByTestId('error-panel');
  await expect(panel).toContainText('could not be read');
  await expect(panel.getByText('moov atom not found')).toBeHidden();
  await panel.getByText('Details').click();
  await expect(panel.getByText('moov atom not found')).toBeVisible();
});

test('the preview page is kept out of search results', async ({ page }) => {
  await page.goto(URL);
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
});
