import fs from 'node:fs';
import path from 'node:path';
import type { MediaInfo } from '../../../src/engine/media';
import { callEngine, openEngine } from './engine';
import { type Page, expect } from './test';

/** Opens a tool page and chooses a fixture, then waits for the tool to be ready. */
export async function openToolWith(page: Page, url: string, fixture: string, readyTestId: string) {
  await page.goto(url);
  await page.locator('input[type="file"]').setInputFiles({
    name: fixture,
    mimeType: 'application/octet-stream',
    buffer: fs.readFileSync(path.join('tests', 'fixtures', fixture)),
  });
  await expect(page.getByTestId(readyTestId)).toBeVisible({ timeout: 90_000 });
}

/** Types a time into a labelled time field and commits it. */
export async function setTime(page: Page, label: string, value: string) {
  const field = page.getByRole('textbox', { name: label, exact: true });
  await field.fill(value);
  await field.press('Enter');
}

export interface ToolResult {
  readonly filename: string;
  readonly bytes: number;
  /** The output read back with ffprobe, through the engine-check page. */
  readonly info: MediaInfo;
}

/**
 * Waits for the result card, downloads the output and reads it back with the real
 * engine. Works in every browser; the WebKit test build cannot play H.264 itself.
 */
export async function downloadAndProbe(page: Page): Promise<ToolResult> {
  const card = page.getByTestId('result-card');
  await expect(card).toBeVisible({ timeout: 120_000 });

  const downloading = page.waitForEvent('download');
  await card.getByRole('link', { name: 'Download' }).click();
  const download = await downloading;
  const filename = download.suggestedFilename();
  const buffer = fs.readFileSync(await download.path());

  const probePage = await page.context().newPage();
  try {
    await openEngine(probePage);
    const [info] = await callEngine(probePage, 'probe', [
      { name: filename, type: 'application/octet-stream', base64: buffer.toString('base64') },
    ]);
    if (!info || 'error' in info) throw new Error(`output could not be read: ${info?.error}`);
    return { filename, bytes: buffer.length, info };
  } finally {
    await probePage.close();
  }
}

/**
 * Checks the result plays in this browser's own player. Skipped in the WebKit test
 * build, which has no H.264 decoder on Windows (real Safari has one).
 */
export async function expectPlayable(page: Page, browserName: string) {
  if (browserName === 'webkit') return;
  const media = page.getByTestId('result-card').locator('video, audio').first();
  await expect
    .poll(() => media.evaluate((el: HTMLMediaElement) => el.readyState), { timeout: 30_000 })
    .toBeGreaterThanOrEqual(1);
}
