import { describe, expect, it, vi } from 'vitest';
import { EngineError } from '../../errors';
import type { FfmpegSession } from './loader';
import { runFfmpeg } from './run';

const status = (seconds: number) =>
  `frame=1 fps=1 q=1 size=1kB time=00:00:${String(seconds).padStart(2, '0')}.00 bitrate=1 speed=1x`;

/** A session whose exec emits the given lines, then resolves or rejects as told. */
function fakeSession(script: {
  lines?: string[];
  exitCode?: number;
  throws?: unknown;
  /** Never settles until terminate() is called, like a long ffmpeg run. */
  hang?: boolean;
}) {
  let rejectRun: ((reason: unknown) => void) | undefined;
  const terminate = vi.fn(() => rejectRun?.(new Error('called FFmpeg.terminate()')));
  const session = {
    lastLog: script.lines ?? [],
    terminate,
    exec: vi.fn(async (_args: readonly string[], options?: { onLog?: (l: string) => void }) => {
      if (script.hang) {
        // Like the real wrapper: the run is already pending when its first log arrives.
        const pending = new Promise<never>((_, reject) => {
          rejectRun = reject;
        });
        for (const line of script.lines ?? []) options?.onLog?.(line);
        return pending;
      }
      for (const line of script.lines ?? []) options?.onLog?.(line);
      if (script.throws !== undefined) throw script.throws;
      return { exitCode: script.exitCode ?? 0, log: script.lines ?? [], stdout: [] };
    }),
  };
  return { session: session as unknown as FfmpegSession, terminate };
}

async function codeOf(promise: Promise<unknown>) {
  const error = await promise.then(
    () => undefined,
    (reason: unknown) => reason,
  );
  expect(error).toBeInstanceOf(EngineError);
  return (error as EngineError).code;
}

describe('runFfmpeg', () => {
  it('reports progress, then 1 when finished', async () => {
    const { session } = fakeSession({ lines: [status(2), status(1), status(5)] });
    const progress: number[] = [];
    await runFfmpeg(session, ['-i', 'x'], {
      expectedDurationSec: 10,
      onProgress: (p) => progress.push(p),
    });
    expect(progress).toEqual([0.2, 0.5, 1]);
  });

  it('maps a non-zero exit code to an engine error', async () => {
    const { session } = fakeSession({
      lines: ['Invalid data found when processing input'],
      exitCode: 1,
    });
    expect(await codeOf(runFfmpeg(session, []))).toBe('unreadable-file');
  });

  it('maps a crash to an engine error', async () => {
    const { session } = fakeSession({ throws: new Error('Aborted(OOM)') });
    expect(await codeOf(runFfmpeg(session, []))).toBe('out-of-memory');
  });

  it('cancels a running job by terminating the session', async () => {
    const { session, terminate } = fakeSession({ lines: [status(1)], hang: true });
    const controller = new AbortController();
    const running = runFfmpeg(session, [], {
      expectedDurationSec: 10,
      signal: controller.signal,
      onProgress: () => controller.abort(),
    });
    expect(await codeOf(running)).toBe('cancelled');
    expect(terminate).toHaveBeenCalledOnce();
  });

  it('does not start when already cancelled', async () => {
    const { session } = fakeSession({});
    const controller = new AbortController();
    controller.abort();
    expect(await codeOf(runFfmpeg(session, [], { signal: controller.signal }))).toBe('cancelled');
    expect(session.exec).not.toHaveBeenCalled();
  });

  it('stops listening to the signal once finished', async () => {
    const { session, terminate } = fakeSession({});
    const controller = new AbortController();
    await runFfmpeg(session, [], { signal: controller.signal });
    controller.abort();
    expect(terminate).not.toHaveBeenCalled();
  });
});
