import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import type { Workspace } from './ffmpeg/workspace';
import { planJob } from './plan';
import { type MediaInfo, parseProbe } from './probe/parse';

const MB = 1024 * 1024;
const info = (fixture: string): MediaInfo =>
  parseProbe(
    fs.readFileSync(path.join(__dirname, 'probe', 'recordings', `${fixture}.json`), 'utf8'),
  );
const ws: Workspace = {
  input: () => '/job1/in/input0.mp4',
  path: (name) => `/job1/${name}`,
  writeFile: async () => undefined,
  readOutput: async () => new Blob(),
};

/** A 60 s 1080p phone clip of the given size. */
function phone(sizeMb: number) {
  const base = info('landscape-720p.mp4');
  const clip: MediaInfo = {
    ...base,
    durationSec: 60,
    video: {
      ...base.video!,
      width: 1920,
      height: 1080,
      displayWidth: 1920,
      displayHeight: 1080,
      fps: 30,
    },
  };
  const file = { name: 'phone.mp4', size: sizeMb * MB, type: 'video/mp4' } as File;
  return { file, info: clip };
}

const toSize = (sizeMb: number, targetMb: number, maxShortSide = 1080) =>
  planJob(
    { kind: 'compressToSize', ...phone(sizeMb), targetBytes: targetMb * MB },
    { maxShortSide },
  );

describe('planJob compressToSize', () => {
  it('encodes at the planned bitrate, scaled to what the bitrate can carry', () => {
    const plan = toSize(120, 16);
    expect(plan.refusal).toBeUndefined();
    expect(plan.filename).toBe('phone-compressed.mp4');
    expect(plan.args(ws)).toEqual([
      '-hide_banner',
      '-i',
      '/job1/in/input0.mp4',
      '-vf',
      'scale=1280:720',
      '-c:v',
      'libx264',
      '-preset',
      'veryfast',
      '-b:v',
      '2051k',
      '-maxrate',
      '2051k',
      '-bufsize',
      '4102k',
      '-pix_fmt',
      'yuv420p',
      '-fpsmax',
      '30',
      '-c:a',
      'aac',
      '-b:a',
      '96k',
      '-ac',
      '2',
      '-movflags',
      '+faststart',
      '/job1/out.mp4',
    ]);
  });

  it("respects the device's lower resolution limit", () => {
    expect(toSize(500, 100, 720).args(ws)).toContain('scale=1280:720');
  });

  it('refuses when the file is already under the target', () => {
    expect(toSize(12, 16).refusal).toEqual({ code: 'already-under-target' });
  });

  it('refuses a target too small to watch, with the smallest that works', () => {
    const plan = toSize(120, 1);
    expect(plan.refusal?.code).toBe('target-unreachable');
    if (plan.refusal?.code === 'target-unreachable') {
      expect(plan.refusal.smallestBytes).toBeGreaterThan(1 * MB);
    }
  });
});

describe('the corrective pass', () => {
  it('runs a second pass at a lower bitrate when the first overshoots', () => {
    const plan = toSize(120, 16);
    const second = plan.retry?.(18 * MB);
    expect(second).toBeTruthy();
    expect(second?.args(ws)).toContain('1695k'); // 2051 x 16/18 x 0.93;
  });

  it('does not run again when the first pass fits', () => {
    expect(toSize(120, 16).retry?.(15 * MB)).toBeNull();
  });

  it('never runs a third pass', () => {
    const second = toSize(120, 16).retry?.(18 * MB);
    expect(second?.retry).toBeUndefined();
  });
});
