import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import type { Workspace } from './ffmpeg/workspace';
import { planJob } from './plan';
import { type MediaInfo, parseProbe } from './probe/parse';

const info = (fixture: string): MediaInfo =>
  parseProbe(
    fs.readFileSync(path.join(__dirname, 'probe', 'recordings', `${fixture}.json`), 'utf8'),
  );
const file = (name: string) => ({ name, size: 100_000, type: 'video/mp4' }) as File;
const ws: Workspace = {
  input: () => '/job1/in/input0.mp4',
  path: (name) => `/job1/${name}`,
  writeFile: async () => undefined,
  readOutput: async () => new Blob(),
};

describe('planJob toMp3', () => {
  it('drops the picture and encodes the sound with LAME at the chosen bitrate', () => {
    const plan = planJob({
      kind: 'toMp3',
      file: file('holiday.mp4'),
      info: info('landscape-720p.mp4'),
      bitrateKbps: 192,
    });
    expect(plan.refusal).toBeUndefined();
    expect(plan.reencodesVideo).toBe(false);
    expect(plan.mime).toBe('audio/mpeg');
    expect(plan.filename).toBe('holiday-audio.mp3');
    expect(plan.args(ws)).toEqual([
      '-hide_banner',
      '-i',
      '/job1/in/input0.mp4',
      '-vn',
      '-c:a',
      'libmp3lame',
      '-b:a',
      '192k',
      '/job1/out.mp3',
    ]);
  });

  it('estimates the size from bitrate and length', () => {
    const plan = planJob({
      kind: 'toMp3',
      file: file('a.mp4'),
      info: info('long-lowres.mp4'),
      bitrateKbps: 128,
    });
    expect(plan.footprint.estimatedOutputBytes).toBe(960_000); // 16 KB/s for 60 s
  });

  it('refuses a video with no sound', () => {
    const plan = planJob({
      kind: 'toMp3',
      file: file('silent.mp4'),
      info: info('no-audio.mp4'),
      bitrateKbps: 192,
    });
    expect(plan.refusal).toEqual({ code: 'no-audio' });
  });
});
