import { EngineError } from '../../errors';
import type { CoreVariant, FfmpegSession } from './loader';

/**
 * Decisions that last for the rest of the visit. Kept in one object owned by the
 * media engine, so every job sees them.
 */
export interface CorePolicy {
  /** Set after the multi-thread core stalls once; every later job uses single-thread. */
  multiThreadDisabled: boolean;
}

export interface CoreRunResult<T> {
  readonly value: T;
  /** The core that produced the result. */
  readonly variant: CoreVariant;
  /** True when the multi-thread core stalled and the job was rerun on single-thread. */
  readonly fellBack: boolean;
}

/**
 * Runs a job on the chosen core. If the multi-thread core stalls, the job is run
 * again from the start on the single-thread core and multi-thread is switched off
 * for the rest of the visit. Any other failure is passed straight through.
 *
 * `getSession` must return a live session for the variant, loading a new one if the
 * last was terminated (a stall terminates it).
 */
export async function runOnCore<T>(options: {
  readonly variant: CoreVariant;
  readonly policy: CorePolicy;
  readonly getSession: (variant: CoreVariant) => Promise<FfmpegSession>;
  readonly job: (session: FfmpegSession) => Promise<T>;
  /** Told when a fallback happens, e.g. to reset progress in the UI. */
  readonly onFallback?: () => void;
}): Promise<CoreRunResult<T>> {
  const { policy, getSession, job } = options;
  const first: CoreVariant = policy.multiThreadDisabled ? 'st' : options.variant;

  // getSession may hand back single-thread if the multi-thread core would not start.
  const session = await getSession(first);
  try {
    return { value: await job(session), variant: session.variant, fellBack: false };
  } catch (error) {
    const stalled = error instanceof EngineError && error.code === 'stalled';
    if (!stalled || session.variant !== 'mt') throw error;
  }

  policy.multiThreadDisabled = true;
  options.onFallback?.();
  return { value: await job(await getSession('st')), variant: 'st', fellBack: true };
}
