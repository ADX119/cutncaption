import { EngineError } from '../../errors';
import { classifyFailure } from './failure';
import type { FfmpegSession } from './loader';
import { createProgressTracker } from './progress';
import { limitThreads, threadCount } from './variant';

export interface RunOptions {
  /** Duration of the output this command produces, for progress. Omit if unknown. */
  readonly expectedDurationSec?: number;
  readonly signal?: AbortSignal;
  /** Called with a fraction from 0 to 1 whenever progress moves forward. */
  readonly onProgress?: (fraction: number) => void;
}

/**
 * Runs one ffmpeg command with progress and cancellation.
 *
 * Cancelling terminates the session: ffmpeg.wasm cannot stop a running command any
 * other way. The caller must load a new session for the next job (the wasm is
 * cached, so that is quick).
 */
export async function runFfmpeg(
  session: FfmpegSession,
  args: readonly string[],
  options: RunOptions = {},
): Promise<{ readonly log: readonly string[] }> {
  const { signal, onProgress } = options;
  if (signal?.aborted) throw new EngineError('cancelled', 'before start');

  const track = createProgressTracker(options.expectedDurationSec ?? 0);
  const onAbort = () => session.terminate();
  signal?.addEventListener('abort', onAbort, { once: true });

  try {
    const finalArgs =
      session.variant === 'mt'
        ? limitThreads(args, threadCount(globalThis.navigator?.hardwareConcurrency))
        : args;
    const result = await session.exec(finalArgs, {
      onLog: (line) => {
        const fraction = track(line);
        if (fraction !== null) onProgress?.(fraction);
      },
    });
    if (signal?.aborted) throw new EngineError('cancelled', 'during run');
    if (result.exitCode !== 0) {
      throw classifyFailure({ exitCode: result.exitCode, log: result.log });
    }
    onProgress?.(1);
    return { log: result.log };
  } catch (error) {
    if (signal?.aborted) {
      throw error instanceof EngineError && error.code === 'cancelled'
        ? error
        : new EngineError('cancelled', 'during run', { cause: error });
    }
    if (error instanceof EngineError) throw error;
    throw classifyFailure({ log: session.lastLog, thrown: error });
  } finally {
    signal?.removeEventListener('abort', onAbort);
  }
}
