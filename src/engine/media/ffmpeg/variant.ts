import type { Capabilities, DeviceClass } from '../../device';
import type { CoreVariant } from './loader';

export interface VariantInput {
  readonly capabilities: Pick<Capabilities, 'crossOriginIsolated' | 'sharedArrayBuffer'>;
  readonly deviceClass: DeviceClass;
  readonly ios: boolean;
  /** True when the job re-encodes video. Stream copies gain nothing from threads. */
  readonly reencodesVideo: boolean;
  /** Set for the rest of the visit once the multi-thread core has stalled (see M1.11). */
  readonly multiThreadDisabled?: boolean;
}

/**
 * Which ffmpeg core a job should use (docs/ARCHITECTURE.md §5).
 *
 * The multi-thread core is faster for encoding but needs cross-origin isolation and
 * SharedArrayBuffer, uses more memory, and is the main cause of tab kills on iOS.
 * Everything else uses the single-thread core, which starts faster and works everywhere.
 */
export function chooseCoreVariant(input: VariantInput): CoreVariant {
  const { capabilities } = input;
  if (input.multiThreadDisabled) return 'st';
  if (!input.reencodesVideo) return 'st';
  if (!capabilities.crossOriginIsolated || !capabilities.sharedArrayBuffer) return 'st';
  if (input.ios) return 'st';
  if (input.deviceClass === 'L') return 'st';
  return 'mt';
}

/** Threads to give x264 and friends on the multi-thread core. */
export function threadCount(hardwareConcurrency: number | undefined): number {
  return Math.max(1, Math.min(hardwareConcurrency ?? 1, 4));
}

/**
 * Caps every thread count in a command for the multi-thread core.
 *
 * The core starts a fixed pool of worker threads. Left to choose, x264 asks for
 * about 1.5 threads per CPU core (30 on a 20-core PC), more than the pool holds, and
 * the run deadlocks with no error. So the engine always states the count: before
 * each input (decoders), before the final output (encoder), and for filter graphs.
 * Command builders must not set threads themselves.
 */
export function limitThreads(args: readonly string[], threads: number): string[] {
  if (args.length === 0) return [];
  const n = String(threads);
  const out = ['-filter_threads', n, '-filter_complex_threads', n];
  args.forEach((arg, index) => {
    if (arg === '-i' || index === args.length - 1) out.push('-threads', n);
    out.push(arg);
  });
  return out;
}
