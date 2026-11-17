import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { LIMITS } from '../device';
import { EngineError } from '../errors';
import { type MediaEngineDeps, createMediaEngine } from './engine';
import type { FfmpegSession } from './ffmpeg/loader';
import type { MediaJob } from './jobs';
import { parseProbe } from './probe/parse';

const info = (fixture: string) =>
  parseProbe(
    fs.readFileSync(path.join(__dirname, 'probe', 'recordings', `${fixture}.json`), 'utf8'),
  );
const fakeFile = (size: number) => ({ name: 'big.mp4', size, type: 'video/mp4' }) as File;

function deps(overrides: Partial<MediaEngineDeps> = {}): MediaEngineDeps {
  return {
    deviceClass: 'H',
    capabilities: { crossOriginIsolated: true, sharedArrayBuffer: true },
    ios: false,
    loadSession: vi.fn(async () => {
      throw new Error('should not load a session in this test');
    }),
    isCoreCached: vi.fn(async () => false),
    ...overrides,
  };
}

/** A loadable fake session that records which cores were loaded. */
function loader() {
  const loaded: string[] = [];
  const loadSession = vi.fn(
    async (
      variant: 'st' | 'mt',
      options?: { onDownload?: (p: { loadedBytes: number; totalBytes: number }) => void },
    ) => {
      loaded.push(variant);
      options?.onDownload?.({ loadedBytes: 10, totalBytes: 10 });
      return { variant, terminated: false, terminate: vi.fn() } as unknown as FfmpegSession;
    },
  );
  return { loaded, loadSession };
}

describe('prepare and needsDownload', () => {
  it('loads the core this device will encode with, reporting the download', async () => {
    const { loaded, loadSession } = loader();
    const engine = createMediaEngine(deps({ loadSession }));
    const progress: number[] = [];
    await engine.prepare({ onDownload: (p) => progress.push(p.loadedBytes) });
    expect(loaded).toEqual(['mt']);
    expect(progress).toEqual([10]);
  });

  it('prepares the single-thread core on iPhone', async () => {
    const { loaded, loadSession } = loader();
    await createMediaEngine(deps({ loadSession, ios: true, deviceClass: 'M' })).prepare();
    expect(loaded).toEqual(['st']);
  });

  it('does not load anything twice', async () => {
    const { loaded, loadSession } = loader();
    const engine = createMediaEngine(deps({ loadSession }));
    await engine.prepare();
    await engine.prepare();
    expect(loaded).toEqual(['mt']);
  });

  it('asks the cache about the core it would prepare', async () => {
    const isCoreCached = vi.fn(async (variant: 'st' | 'mt') => variant === 'mt');
    const engine = createMediaEngine(deps({ isCoreCached }));
    expect(await engine.needsDownload()).toBe(false);
    expect(isCoreCached).toHaveBeenCalledWith('mt');
  });
});

async function codeOf(promise: Promise<unknown>) {
  const error = await promise.then(
    () => undefined,
    (reason: unknown) => reason,
  );
  expect(error).toBeInstanceOf(EngineError);
  return (error as EngineError).code;
}

describe('assess', () => {
  it('reports copy for a remuxable file', () => {
    const engine = createMediaEngine(deps());
    const job: MediaJob = { kind: 'toMp4', file: fakeFile(1000), info: info('clip.mov') };
    expect(engine.assess(job)).toEqual({ blocks: [], warnings: [], path: 'copy' });
  });

  it('reports the multi-thread core for a re-encode on a capable desktop', () => {
    const engine = createMediaEngine(deps());
    const job: MediaJob = { kind: 'toMp4', file: fakeFile(1000), info: info('clip.webm') };
    expect(engine.assess(job).path).toBe('ffmpeg-mt');
  });

  it('reports single-thread on iPhone', () => {
    const engine = createMediaEngine(deps({ ios: true, deviceClass: 'M' }));
    const job: MediaJob = { kind: 'toMp4', file: fakeFile(1000), info: info('clip.webm') };
    expect(engine.assess(job).path).toBe('ffmpeg-st');
  });

  it('warns about a long re-encode on a low-end phone without blocking it', () => {
    const engine = createMediaEngine(deps({ deviceClass: 'L' }));
    const long = { ...info('clip.webm'), durationSec: LIMITS.L.maxReencodeSeconds + 60 };
    const result = engine.assess({ kind: 'toMp4', file: fakeFile(1000), info: long });
    expect(result.blocks).toEqual([]);
    expect(result.warnings.map((w) => w.code)).toEqual(['reencode-too-long']);
  });
});

describe('run', () => {
  it('refuses an over-limit file with its limit code, before loading anything', async () => {
    const d = deps({ deviceClass: 'L' });
    const engine = createMediaEngine(d);
    const job: MediaJob = {
      kind: 'toMp4',
      file: fakeFile(LIMITS.L.maxInputBytes + 1),
      info: info('clip.mov'),
    };
    expect(await codeOf(engine.run(job))).toBe('input-too-large');
    expect(d.loadSession).not.toHaveBeenCalled();
  });

  it('runs one job at a time', async () => {
    let release: () => void = () => undefined;
    const engine = createMediaEngine(
      deps({
        loadSession: vi.fn(
          () =>
            new Promise<FfmpegSession>((_, reject) => {
              release = () => reject(new Error('stopped'));
            }),
        ),
      }),
    );
    const job: MediaJob = { kind: 'toMp4', file: fakeFile(1000), info: info('clip.mov') };
    const first = engine.run(job);
    expect(await codeOf(engine.run(job))).toBe('busy');
    expect(await codeOf(engine.probe(fakeFile(10)))).toBe('busy');
    release();
    await expect(first).rejects.toThrow('stopped');
  });
});
