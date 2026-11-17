import fs from 'node:fs';
import path from 'node:path';
import type { Page } from '@playwright/test';
import type { EngineHarness, HarnessFile } from '../../../src/engine/media';

const FIXTURES = path.join(process.cwd(), 'tests', 'fixtures');
const TYPES: Record<string, string> = {
  '.mp4': 'video/mp4',
  '.mov': 'video/quicktime',
  '.webm': 'video/webm',
  '.mkv': 'video/x-matroska',
  '.avi': 'video/x-msvideo',
  '.mp3': 'audio/mpeg',
};

/** A fixture from tests/fixtures, ready to hand to the engine harness. */
export function fixture(name: string): HarnessFile {
  return {
    name,
    type: TYPES[path.extname(name)] ?? 'application/octet-stream',
    base64: fs.readFileSync(path.join(FIXTURES, name)).toString('base64'),
  };
}

/** Opens the Engine check page and waits until its test hooks are attached. */
export async function openEngine(page: Page): Promise<void> {
  await page.goto('/tools/engine-check/');
  await page.waitForFunction(() => window.__cncEngine !== undefined);
}

type Method = keyof EngineHarness;

/** Calls a harness method inside the page and returns its result. */
export function callEngine<M extends Method>(
  page: Page,
  method: M,
  ...args: Parameters<EngineHarness[M]>
): Promise<Awaited<ReturnType<EngineHarness[M]>>> {
  return page.evaluate(
    ([name, params]) => {
      const harness = window.__cncEngine;
      if (!harness) throw new Error('engine harness not attached');
      const fn = harness[name as Method] as (...a: unknown[]) => unknown;
      return fn(...(params as unknown[]));
    },
    [method, args] as const,
  ) as Promise<Awaited<ReturnType<EngineHarness[M]>>>;
}
