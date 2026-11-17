import { EngineError } from '../../errors';
import { classifyFailure } from './failure';
import type { FfmpegSession } from './loader';
import { createProgressTracker } from './progress';
import { limitThreads, threadCount } from './variant';

/** A run that prints nothing for this long is treated as stuck (docs/ARCHITECTURE.md §5). */
export const DEFAULT_STALL_TIMEOUT_MS = 20_000;

export interface RunOptions {
  /** Duration of the output this command produces, for progress. Omit if unknown. */
  readonly expectedDurationSec?: number;
  readonly signal?: AbortSignal;
  /** Called with a fraction from 0 to 1 whenever progress moves forward. */
  readonly onProgress?: (fraction: number) => void;
  /** Silence longer than this ends the run with "stalled". Defaults to 20 s. */
  readonly stallTimeoutMs?: number;
}

/**
 * Runs one ffmpeg command with progress, cancellation and a stall watchdog.
 *
 * Cancelling or stalling terminates the session: ffmpeg.wasm cannot stop a running
 * command any other way. The caller must load a new session for the next job (the
 * wasm is cached, so that is quick). ffmpeg prints a status line about twice a
 * second while working, so a long silence means it is stuck, not busy.
 */
export async function runFfmpeg(
  session: FfmpegSession,
  args: readonly string[],
  options: RunOptions = {},
): Promise<{ readonly log: readonly string[] }> {
  const { signal, onProgress } = options;
  if (signal?.aborted) throw new EngineError('cancelled', 'before start');

  const track = createProgressTracker(options.expectedDurationSec ?? 0);
  const stallTimeoutMs = options.stallTimeoutMs ?? DEFAULT_STALL_TIMEOUT_MS;
  let lastActivity = Date.now();
  let stalled = false;

  const onAbort = () => session.terminate();
  signal?.addEventListener('abort', onAbort, { once: true });
  const watchdog = setInterval(
    () => {
      if (Date.now() - lastActivity < stallTimeoutMs) return;
      stalled = true;
      session.terminate();
    },
    Math.min(1000, stallTimeoutMs),
  );

  try {
    const finalArgs =
      session.variant === 'mt'
        ? limitThreads(args, threadCount(globalThis.navigator?.hardwareConcurrency))
        : args;
    const result = await session.exec(finalArgs, {
      onLog: (line) => {
        lastActivity = Date.now();
        const fraction = track(line);
        if (fraction !== null) onProgress?.(fraction);
      },
    });
    if (signal?.aborted) throw new EngineError('cancelled', 'during run');
    if (stalled) throw stallError(session);
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
    if (stalled) throw stallError(session, error);
    if (error instanceof EngineError) throw error;
    throw classifyFailure({ log: session.lastLog, thrown: error });
  } finally {
    clearInterval(watchdog);
    signal?.removeEventListener('abort', onAbort);
  }
}

function stallError(session: FfmpegSession, cause?: unknown): EngineError {
  const tail = session.lastLog.slice(-5).join('\n');
  return new EngineError('stalled', `${session.variant} core went silent\n${tail}`, { cause });
}
