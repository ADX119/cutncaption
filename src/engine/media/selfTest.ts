import { assets } from '../assets';
import { type CoreVariant, FfmpegSession, coreLocation } from './ffmpeg/loader';

export interface SelfTestResult {
  readonly variant: CoreVariant;
  /** e.g. "5.1.4", parsed from `ffmpeg -version`. */
  readonly ffmpegVersion: string;
  /** Whether the wasm came from the browser cache instead of a download. */
  readonly fromCache: boolean;
  readonly loadMs: number;
}

/** "ffmpeg version 5.1.4 Copyright …" -> "5.1.4". Undefined if the banner is missing. */
export function parseFfmpegVersion(log: readonly string[]): string | undefined {
  for (const line of log) {
    const match = /^ffmpeg version (\S+)/.exec(line);
    if (match) return match[1];
  }
  return undefined;
}

/**
 * Loads ffmpeg, runs `-version` and shuts it down again. Used by the Engine check
 * page to prove the whole chain works in this browser: scripts, wasm download,
 * cache, worker start-up and a real command.
 */
export async function runSelfTest(
  variant: CoreVariant = 'st',
  signal?: AbortSignal,
): Promise<SelfTestResult> {
  const started = performance.now();
  const { wasmKey } = coreLocation(variant, globalThis.location.origin);
  const fromCache = await assets().isCached(wasmKey);

  const session = await FfmpegSession.load({ variant, signal });
  try {
    const loadMs = Math.round(performance.now() - started);
    const { log } = await session.exec(['-version']);
    return {
      variant,
      ffmpegVersion: parseFfmpegVersion(log) ?? 'unknown',
      fromCache,
      loadMs,
    };
  } finally {
    session.terminate();
    void assets().pruneCache();
  }
}
