import { classifyDevice, detectCapabilities, isIos, readDeviceEnv } from '../device';
import { EngineError } from '../errors';
import { createMediaEngine } from './engine';
import type { MediaJob } from './jobs';
import { type CoreVariant, FfmpegSession } from './ffmpeg/loader';
import { chooseCoreVariant } from './ffmpeg/variant';
import { runFfmpeg } from './ffmpeg/run';
import { withWorkspace } from './ffmpeg/workspace';
import type { MediaInfo } from './probe/parse';
import { probeFile } from './probe/probe';

/**
 * Hooks for the browser tests, attached to `window.__cncEngine` on the Engine check
 * page only. They drive the real engine with files the test supplies, on the local
 * build and on the live site. They read nothing from the page and send nothing
 * anywhere, so exposing them gives a visitor no ability they did not already have.
 */

/** A file as the test passes it in (bytes travel as base64). */
export interface HarnessFile {
  readonly name: string;
  readonly type: string;
  readonly base64: string;
}

function toFile({ name, type, base64 }: HarnessFile): File {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return new File([bytes], name, { type });
}

/** Folders at the root of ffmpeg's file system that a workspace could have left behind. */
async function leftovers(session: FfmpegSession): Promise<string[]> {
  const entries = await session.fs.listDir('/');
  return entries.map((entry) => entry.name).filter((name) => name.startsWith('job'));
}

export interface WorkspaceCheck {
  readonly outputBytes: number;
  readonly outputType: string;
  readonly leftoversAfterSuccess: readonly string[];
  readonly errorMessage: string;
  readonly leftoversAfterError: readonly string[];
}

/** M1.7: a mounted input can be processed, and nothing is left behind, even on error. */
async function workspaceCheck(input: HarnessFile): Promise<WorkspaceCheck> {
  const session = await FfmpegSession.load({ variant: 'st' });
  try {
    const file = toFile(input);
    const output = await withWorkspace(session.fs, [file], async (ws) => {
      const { exitCode } = await session.exec([
        '-hide_banner',
        '-i',
        ws.input(),
        '-c',
        'copy',
        ws.path('copy.mp4'),
      ]);
      if (exitCode !== 0) throw new Error(`ffmpeg exited with ${exitCode}`);
      return ws.readOutput('copy.mp4', 'video/mp4');
    });
    const leftoversAfterSuccess = await leftovers(session);

    let errorMessage = '';
    try {
      await withWorkspace(session.fs, [file], async (ws) => {
        await ws.writeFile('partial.bin', new Uint8Array([1, 2, 3]));
        throw new Error('simulated failure');
      });
    } catch (error) {
      errorMessage = error instanceof Error ? error.message : String(error);
    }

    return {
      outputBytes: output.size,
      outputType: output.type,
      leftoversAfterSuccess,
      errorMessage,
      leftoversAfterError: await leftovers(session),
    };
  } finally {
    session.terminate();
  }
}

/** M1.8: what the engine reads from each file. Probes them all in one session. */
async function probe(inputs: readonly HarnessFile[]): Promise<(MediaInfo | { error: string })[]> {
  const session = await FfmpegSession.load({ variant: 'st' });
  try {
    const results: (MediaInfo | { error: string })[] = [];
    for (const input of inputs) {
      try {
        results.push(await probeFile(session, toFile(input)));
      } catch (error) {
        results.push({ error: error instanceof Error ? error.message : String(error) });
      }
    }
    return results;
  } finally {
    session.terminate();
  }
}

/** A real encode: the whole 60 s fixture through x264, so it runs for a few seconds. */
const encodeArgs = (input: string, output: string) => [
  '-hide_banner',
  '-i',
  input,
  '-c:v',
  'libx264',
  '-preset',
  'veryfast',
  '-c:a',
  'aac',
  output,
];

export interface RunnerCheck {
  readonly progress: readonly number[];
  readonly outputBytes: number;
  readonly cancelledWith: string;
  readonly progressBeforeCancel: number;
  readonly afterCancelOutputBytes: number;
}

/** M1.9: progress during a real encode; cancel mid-job; the next job still works. */
async function runnerCheck(input: HarnessFile): Promise<RunnerCheck> {
  const file = toFile(input);

  // 1. A full run, collecting progress.
  const progress: number[] = [];
  let session = await FfmpegSession.load({ variant: 'st' });
  const outputBytes = await withWorkspace(session.fs, [file], async (ws) => {
    await runFfmpeg(session, encodeArgs(ws.input(), ws.path('out.mp4')), {
      expectedDurationSec: 60,
      onProgress: (fraction) => progress.push(fraction),
    });
    return (await ws.readOutput('out.mp4', 'video/mp4')).size;
  });

  // 2. Cancel once the encode is a quarter done.
  const controller = new AbortController();
  let progressBeforeCancel = 0;
  let cancelledWith = 'not cancelled';
  try {
    await withWorkspace(session.fs, [file], (ws) =>
      runFfmpeg(session, encodeArgs(ws.input(), ws.path('out.mp4')), {
        expectedDurationSec: 60,
        signal: controller.signal,
        onProgress: (fraction) => {
          progressBeforeCancel = fraction;
          if (fraction >= 0.25) controller.abort();
        },
      }),
    );
  } catch (error) {
    cancelledWith = error instanceof EngineError ? error.code : String(error);
  }

  // 3. Cancelling killed that session; a new one must work.
  session = await FfmpegSession.load({ variant: 'st' });
  try {
    const afterCancelOutputBytes = await withWorkspace(session.fs, [file], async (ws) => {
      await runFfmpeg(session, [
        '-hide_banner',
        '-i',
        ws.input(),
        '-t',
        '2',
        '-c',
        'copy',
        ws.path('short.mp4'),
      ]);
      return (await ws.readOutput('short.mp4', 'video/mp4')).size;
    });
    return { progress, outputBytes, cancelledWith, progressBeforeCancel, afterCancelOutputBytes };
  } finally {
    session.terminate();
  }
}

export interface CoreCheck {
  /** What chooseCoreVariant picks for a re-encode in this browser. */
  readonly selected: CoreVariant;
  readonly results: readonly {
    readonly variant: CoreVariant;
    readonly ok: boolean;
    readonly ms: number;
    readonly outputBytes: number;
    readonly error: string;
  }[];
}

/** M1.10: the same real encode on each core, timed, plus this browser's selection. */
async function coreCheck(input: HarnessFile, variants: readonly CoreVariant[]): Promise<CoreCheck> {
  const file = toFile(input);
  const results: CoreCheck['results'][number][] = [];
  for (const variant of variants) {
    const started = performance.now();
    let session: FfmpegSession | undefined;
    try {
      session = await FfmpegSession.load({ variant });
      const loaded = session;
      const outputBytes = await withWorkspace(loaded.fs, [file], async (ws) => {
        await runFfmpeg(loaded, encodeArgs(ws.input(), ws.path('out.mp4')), {
          expectedDurationSec: 60,
        });
        return (await ws.readOutput('out.mp4', 'video/mp4')).size;
      });
      results.push({
        variant,
        ok: true,
        ms: Math.round(performance.now() - started),
        outputBytes,
        error: '',
      });
    } catch (error) {
      results.push({
        variant,
        ok: false,
        ms: Math.round(performance.now() - started),
        outputBytes: 0,
        error: String(error),
      });
    } finally {
      session?.terminate();
    }
  }
  const env = readDeviceEnv();
  const selected = chooseCoreVariant({
    capabilities: detectCapabilities(),
    deviceClass: classifyDevice(env),
    ios: isIos(env),
    reencodesVideo: true,
  });
  return { selected, results };
}

export interface EngineRunCheck {
  readonly path: string;
  readonly filename: string;
  readonly mime: string;
  readonly fellBack: boolean;
  readonly progressCount: number;
  readonly output: MediaInfo;
}

/** M1.12: the public engine, end to end: probe, convert to MP4, re-probe the output. */
async function engineRun(input: HarnessFile): Promise<EngineRunCheck> {
  const engine = createMediaEngine();
  try {
    const file = toFile(input);
    const info = await engine.probe(file);
    let progressCount = 0;
    const result = await engine.run(
      { kind: 'toMp4', file, info },
      { onProgress: () => (progressCount += 1) },
    );
    const output = await engine.probe(
      new File([result.blob], result.filename, { type: result.mime }),
    );
    return {
      path: result.path,
      filename: result.filename,
      mime: result.mime,
      fellBack: result.fellBack,
      progressCount,
      output,
    };
  } finally {
    engine.release();
  }
}

/** Any job's own settings, without the file and probe the harness supplies. */
export type JobSpec = MediaJob extends infer J
  ? J extends MediaJob
    ? Omit<J, 'file' | 'info'>
    : never
  : never;

export interface EngineJobCheck {
  readonly path: string;
  readonly filename: string;
  readonly bytes: number;
  readonly output: MediaInfo;
}

/** Runs any engine job on a test file and reads the output back with ffprobe. */
async function engineJob(input: HarnessFile, spec: JobSpec): Promise<EngineJobCheck> {
  const engine = createMediaEngine();
  try {
    const file = toFile(input);
    const info = await engine.probe(file);
    const result = await engine.run({ ...spec, file, info } as MediaJob);
    const output = await engine.probe(
      new File([result.blob], result.filename, { type: result.mime }),
    );
    return { path: result.path, filename: result.filename, bytes: result.blob.size, output };
  } finally {
    engine.release();
  }
}

export const engineHarness = {
  workspaceCheck,
  probe,
  runnerCheck,
  coreCheck,
  engineRun,
  engineJob,
};
export type EngineHarness = typeof engineHarness;
