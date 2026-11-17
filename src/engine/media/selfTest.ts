import { assets } from '../assets';
import {
  type CapabilityKind,
  type CapabilitySet,
  LIST_FLAGS,
  REQUIRED_CAPABILITIES,
  missingCapabilities,
  parseCapabilityLog,
} from './ffmpeg/capabilities';
import { type CoreVariant, FfmpegSession, coreLocation } from './ffmpeg/loader';

export interface SelfTestResult {
  readonly variant: CoreVariant;
  /** e.g. "5.1.4", parsed from `ffmpeg -version`. */
  readonly ffmpegVersion: string;
  /** Whether the wasm came from the browser cache instead of a download. */
  readonly fromCache: boolean;
  readonly loadMs: number;
  /** How many codec, filter and format requirements the tools have. */
  readonly requiredCount: number;
  /** Requirements this core does not meet, e.g. "decoder hevc". Empty means all present. */
  readonly missing: readonly string[];
}

/** "ffmpeg version 5.1.4 Copyright …" -> "5.1.4". Undefined if the banner is missing. */
export function parseFfmpegVersion(log: readonly string[]): string | undefined {
  for (const line of log) {
    const match = /^ffmpeg version (\S+)/.exec(line);
    if (match) return match[1];
  }
  return undefined;
}

async function readCapabilities(session: FfmpegSession): Promise<CapabilitySet> {
  const list = async (kind: CapabilityKind) =>
    parseCapabilityLog(kind, (await session.exec(['-hide_banner', LIST_FLAGS[kind]])).log);
  // One at a time: a session runs one command at once.
  const encoder = await list('encoder');
  const decoder = await list('decoder');
  const filter = await list('filter');
  const muxer = await list('muxer');
  const demuxer = await list('demuxer');
  return { encoder, decoder, filter, muxer, demuxer };
}

/**
 * Loads ffmpeg, runs `-version`, checks that every codec, filter and format the
 * tools need is present, and shuts it down again. Used by the Engine check page to
 * prove the whole chain works in this browser.
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
    const capabilities = await readCapabilities(session);
    return {
      variant,
      ffmpegVersion: parseFfmpegVersion(log) ?? 'unknown',
      fromCache,
      loadMs,
      requiredCount: REQUIRED_CAPABILITIES.length,
      missing: missingCapabilities(capabilities),
    };
  } finally {
    session.terminate();
    void assets().pruneCache();
  }
}
