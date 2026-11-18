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
  input: () => '/job1/in/input0.mov',
  path: (name) => `/job1/${name}`,
  writeFile: async () => undefined,
  readOutput: async () => new Blob(),
};

describe('planJob mute', () => {
  it('copies the picture, drops the sound, and keeps the container', () => {
    const plan = planJob({ kind: 'mute', file: file('clip.mov'), info: info('clip.mov') });
    expect(plan.path).toBe('copy');
    expect(plan.refusal).toBeUndefined();
    expect(plan.filename).toBe('clip-muted.mov');
    expect(plan.mime).toBe('video/quicktime');
    expect(plan.args(ws)).toEqual([
      '-hide_banner',
      '-i',
      '/job1/in/input0.mov',
      '-map',
      '0:v:0',
      '-c:v',
      'copy',
      '-an',
      '-movflags',
      '+faststart',
      '/job1/out.mov',
    ]);
  });

  it('keeps a WebM as WebM, without MP4-only flags', () => {
    const plan = planJob({ kind: 'mute', file: file('clip.webm'), info: info('clip.webm') });
    expect(plan.outputName).toBe('out.webm');
    expect(plan.args(ws)).not.toContain('+faststart');
  });

  it('refuses a video that is already silent', () => {
    const plan = planJob({ kind: 'mute', file: file('a.mp4'), info: info('no-audio.mp4') });
    expect(plan.refusal).toEqual({ code: 'already-silent' });
  });

  it('refuses a file with no picture', () => {
    const plan = planJob({ kind: 'mute', file: file('a.mp3'), info: info('tone.mp3') });
    expect(plan.refusal).toEqual({ code: 'no-video' });
  });
});
