import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import type { Workspace } from './ffmpeg/workspace';
import { outputFilename } from './jobs';
import { estimateEncodedBytes, isMp4Compatible, planJob } from './plan';
import { type MediaInfo, parseProbe } from './probe/parse';

const info = (fixture: string): MediaInfo =>
  parseProbe(
    fs.readFileSync(path.join(__dirname, 'probe', 'recordings', `${fixture}.json`), 'utf8'),
  );
const file = (name: string, size = 100_000) => ({ name, size, type: 'video/mp4' }) as File;
const ws: Workspace = {
  input: () => '/job1/in/input0.mp4',
  path: (name) => `/job1/${name}`,
  writeFile: async () => undefined,
  readOutput: async () => new Blob(),
};

describe('isMp4Compatible', () => {
  it.each([
    ['landscape-720p.mp4', true],
    ['clip.mov', true],
    ['no-audio.mp4', true],
    ['clip.webm', false],
    ['clip.mkv', false], // H.264 with Opus audio
    ['clip.avi', false],
  ])('%s -> %s', (fixture, expected) => {
    expect(isMp4Compatible(info(fixture))).toBe(expected);
  });
});

describe('planJob toMp4', () => {
  it('remuxes H.264/AAC without re-encoding', () => {
    const plan = planJob({ kind: 'toMp4', file: file('clip.mov'), info: info('clip.mov') });
    expect(plan.path).toBe('copy');
    expect(plan.reencodesVideo).toBe(false);
    expect(plan.args(ws)).toEqual([
      '-hide_banner',
      '-i',
      '/job1/in/input0.mp4',
      '-c',
      'copy',
      '-movflags',
      '+faststart',
      '/job1/out.mp4',
    ]);
    expect(plan.footprint).toEqual({
      inputBytes: 100_000,
      estimatedOutputBytes: 100_000,
      reencodeSeconds: undefined,
    });
  });

  it('re-encodes other codecs to H.264/AAC', () => {
    const plan = planJob({ kind: 'toMp4', file: file('clip.webm'), info: info('clip.webm') });
    expect(plan.path).toBe('ffmpeg');
    expect(plan.reencodesVideo).toBe(true);
    expect(plan.args(ws)).toEqual([
      '-hide_banner',
      '-i',
      '/job1/in/input0.mp4',
      '-c:v',
      'libx264',
      '-preset',
      'veryfast',
      '-crf',
      '22',
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
    expect(plan.footprint.reencodeSeconds).toBeCloseTo(3, 1);
  });

  it('drops audio cleanly when there is none', () => {
    const silent = { ...info('clip.webm'), audio: null };
    const args = planJob({ kind: 'toMp4', file: file('a.webm'), info: silent }).args(ws);
    expect(args).toContain('-an');
    expect(args).not.toContain('aac');
  });

  it('names the output after the input', () => {
    const plan = planJob({ kind: 'toMp4', file: file('Holiday 2026.MOV'), info: info('clip.mov') });
    expect(plan.filename).toBe('Holiday 2026-converted.mp4');
  });
});

describe('estimateEncodedBytes', () => {
  it('scales with duration and resolution', () => {
    const small = estimateEncodedBytes(info('long-lowres.mp4'));
    const big = estimateEncodedBytes(info('landscape-720p.mp4'));
    // 60 s at the lowest tier vs 5 s at 720p.
    expect(small).toBe(Math.round(((1_200_000 + 128_000) * 60) / 8));
    expect(big).toBe(Math.round(((2_500_000 + 128_000) * 5) / 8));
  });
});

describe('outputFilename', () => {
  it.each([
    ['clip.mp4', 'trimmed', 'mp4', 'clip-trimmed.mp4'],
    ['मेरा वीडियो.mov', 'converted', 'mp4', 'मेरा वीडियो-converted.mp4'],
    ['a:b?c.mp4', 'muted', 'mp4', 'a_b_c-muted.mp4'],
    ['.mp4', 'audio', 'mp3', 'video-audio.mp3'],
    ['no extension', 'audio', 'mp3', 'no extension-audio.mp3'],
  ])('%s -> %s', (original, action, extension, expected) => {
    expect(outputFilename(original, action, extension)).toBe(expected);
  });
});
