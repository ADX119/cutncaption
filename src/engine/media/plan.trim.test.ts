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
const file = (name: string, size = 100_000) => ({ name, size, type: 'video/mp4' }) as File;
const ws: Workspace = {
  input: () => '/job1/in/input0.mov',
  path: (name) => `/job1/${name}`,
  writeFile: async () => undefined,
  readOutput: async () => new Blob(),
};

describe('planJob trim, fast', () => {
  it('stream-copies the selection and keeps the source container', () => {
    const plan = planJob({
      kind: 'trim',
      file: file('clip.mov'),
      info: info('clip.mov'),
      start: 1,
      end: 2.5,
      mode: 'fast',
    });
    expect(plan.path).toBe('copy');
    expect(plan.reencodesVideo).toBe(false);
    expect(plan.outputName).toBe('out.mov');
    expect(plan.mime).toBe('video/quicktime');
    expect(plan.filename).toBe('clip-trimmed.mov');
    expect(plan.expectedDurationSec).toBe(1.5);
    expect(plan.args(ws)).toEqual([
      '-hide_banner',
      '-ss',
      '1',
      '-i',
      '/job1/in/input0.mov',
      '-t',
      '1.5',
      '-map',
      '0:v:0?',
      '-map',
      '0:a?',
      '-c',
      'copy',
      '-avoid_negative_ts',
      'make_zero',
      '-movflags',
      '+faststart',
      '/job1/out.mov',
    ]);
  });

  it.each([
    ['clip.webm', 'webm', 'video/webm'],
    ['clip.mkv', 'mkv', 'video/x-matroska'],
    ['clip.avi', 'avi', 'video/x-msvideo'],
    ['landscape-720p.mp4', 'mp4', 'video/mp4'],
  ])('keeps %s in its own container', (fixture, extension, mime) => {
    const plan = planJob({
      kind: 'trim',
      file: file(fixture),
      info: info(fixture),
      start: 0,
      end: 1,
      mode: 'fast',
    });
    expect(plan.outputName).toBe(`out.${extension}`);
    expect(plan.mime).toBe(mime);
  });

  it('adds faststart for MP4 and MOV only', () => {
    const mp4 = planJob({
      kind: 'trim',
      file: file('a.mp4'),
      info: info('landscape-720p.mp4'),
      start: 0,
      end: 1,
      mode: 'fast',
    }).args(ws);
    const webm = planJob({
      kind: 'trim',
      file: file('a.webm'),
      info: info('clip.webm'),
      start: 0,
      end: 1,
      mode: 'fast',
    }).args(ws);
    expect(mp4).toContain('+faststart');
    expect(webm).not.toContain('+faststart');
  });

  it('estimates the output from the share of the file kept', () => {
    const plan = planJob({
      kind: 'trim',
      file: file('long.mp4', 600_000),
      info: info('long-lowres.mp4'),
      start: 0,
      end: 15,
      mode: 'fast',
    });
    expect(plan.footprint.estimatedOutputBytes).toBe(150_000);
  });
});

describe('planJob trim, precise', () => {
  it('re-encodes the selection to H.264/AAC MP4 for exact cut points', () => {
    const plan = planJob({
      kind: 'trim',
      file: file('clip.webm'),
      info: info('clip.webm'),
      start: 0.5,
      end: 2,
      mode: 'precise',
    });
    expect(plan.path).toBe('ffmpeg');
    expect(plan.reencodesVideo).toBe(true);
    expect(plan.filename).toBe('clip-trimmed.mp4');
    expect(plan.footprint.reencodeSeconds).toBe(1.5);
    expect(plan.args(ws)).toEqual([
      '-hide_banner',
      '-ss',
      '0.5',
      '-i',
      '/job1/in/input0.mov',
      '-t',
      '1.5',
      '-c:v',
      'libx264',
      '-preset',
      'veryfast',
      '-crf',
      '20',
      '-pix_fmt',
      'yuv420p',
      '-fpsmax',
      '30',
      '-c:a',
      'aac',
      '-b:a',
      '128k',
      '-ac',
      '2',
      '-movflags',
      '+faststart',
      '/job1/out.mp4',
    ]);
  });

  it('leaves out audio settings for a silent video', () => {
    const args = planJob({
      kind: 'trim',
      file: file('a.mp4'),
      info: info('no-audio.mp4'),
      start: 0,
      end: 1,
      mode: 'precise',
    }).args(ws);
    expect(args).toContain('-an');
    expect(args).not.toContain('aac');
  });
});
