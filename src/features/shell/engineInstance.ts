import type { AssetProgress } from '@/engine/assets';
import { type MediaEngine, createMediaEngine } from '@/engine/media';

let engine: MediaEngine | undefined;
let ready: Promise<void> | undefined;
const downloadListeners = new Set<(progress: AssetProgress) => void>();

/** The page's one media engine. Created on first use, in the browser only. */
export function getEngine(): MediaEngine {
  engine ??= createMediaEngine();
  return engine;
}

/**
 * Gets the engine ready once per page, however many callers ask. A caller that wants
 * download progress passes a listener; it hears progress until the engine is ready.
 * A failure clears the shared attempt so the next call can try again.
 */
export function ensureEngineReady(onDownload?: (progress: AssetProgress) => void): Promise<void> {
  if (onDownload) downloadListeners.add(onDownload);
  ready ??= getEngine()
    .prepare({ onDownload: (progress) => downloadListeners.forEach((listen) => listen(progress)) })
    .catch((error: unknown) => {
      ready = undefined;
      throw error;
    });
  return ready.finally(() => {
    if (onDownload) downloadListeners.delete(onDownload);
  });
}

/**
 * When the engine is already on this device, load it while the page is idle so the
 * first job starts at once. When it is not, wait: a 31 MB download should only
 * happen once the person has chosen a file.
 */
export function prewarmEngine(): () => void {
  let cancelled = false;
  const run = async () => {
    if (cancelled || ready) return;
    if (await getEngine().needsDownload()) return;
    if (!cancelled) ensureEngineReady().catch(() => undefined);
  };
  if (typeof window.requestIdleCallback === 'function') {
    const id = window.requestIdleCallback(() => void run(), { timeout: 3000 });
    return () => {
      cancelled = true;
      window.cancelIdleCallback(id);
    };
  }
  const id = window.setTimeout(() => void run(), 1000);
  return () => {
    cancelled = true;
    window.clearTimeout(id);
  };
}
