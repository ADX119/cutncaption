import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import type { Workspace } from './ffmpeg/workspace';
import { estimateCompressedBytes, planJob } from './plan';
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

/** A fake 1080p phone clip, 60 s at 30 fps, built from a real probe. */
function phoneClip(rotation: 0 | 90 = 0): MediaInfo {
  const base = info('landscape-720p.mp4');
  const video = base.video!; // the fixture has video
  return {
    ...base,
    durationSec: 60,
    video: {
      ...video,
      width: 1920,
      height: 1080,
      rotation,
      displayWidth: rotation === 90 ? 1080 : 1920,
      displayHeight: rotation === 90 ? 1920 : 1080,
      fps: 30,
    },
  };
}

const compress = (i: MediaInfo, quality: 'light' | 'balanced' | 'small', maxShortSide = 1080) =>
  planJob({ kind: 'compress', file: file('phone.mp4'), info: i, quality }, { maxShortSide });

describe('planJob compress', () => {
  it('scales a 1080p clip to 720p at CRF 28 for Balanced', () => {
    const plan = compress(phoneClip(), 'balanced');
    expect(plan.path).toBe('ffmpeg');
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
      '-crf',
      '28',
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

  it('keeps a portrait phone video portrait', () => {
    expect(compress(phoneClip(90), 'small').args(ws)).toContain('scale=480:854');
  });

  it('does not resample a video that already fits', () => {
    // The 720p fixture under Light (cap 1080) is left at its size.
    const args = compress(info('landscape-720p.mp4'), 'light').args(ws);
    expect(args).not.toContain('-vf');
    expect(args).toContain('23');
  });

  it("applies the device's lower limit on a low-end phone", () => {
    expect(compress(phoneClip(), 'light', 720).args(ws)).toContain('scale=1280:720');
  });

  it('re-encodes only the audio of an audio file', () => {
    const args = compress(info('tone.mp3'), 'small').args(ws);
    expect(args).toContain('-vn');
    expect(args).not.toContain('libx264');
    expect(args).toContain('64k');
  });

  it('feeds its estimate into the device limit check', () => {
    const plan = compress(phoneClip(), 'balanced');
    expect(plan.footprint.estimatedOutputBytes).toBe(
      estimateCompressedBytes(phoneClip(), { width: 1280, height: 720 }, 'balanced'),
    );
    expect(plan.footprint.reencodeSeconds).toBe(60);
  });
});

describe('estimateCompressedBytes', () => {
  it('lands in a believable range for a minute of 1080p phone video', () => {
    const clip = phoneClip();
    const mb = (bytes: number) => bytes / 1024 / 1024;
    const light = mb(estimateCompressedBytes(clip, { width: 1920, height: 1080 }, 'light'));
    const balanced = mb(estimateCompressedBytes(clip, { width: 1280, height: 720 }, 'balanced'));
    const small = mb(estimateCompressedBytes(clip, { width: 854, height: 480 }, 'small'));
    // Phones record about 100–130 MB a minute at 1080p30.
    expect(light).toBeGreaterThan(20);
    expect(light).toBeLessThan(40);
    expect(balanced).toBeGreaterThan(5);
    expect(balanced).toBeLessThan(15);
    expect(small).toBeGreaterThan(1.5);
    expect(small).toBeLessThan(5);
  });

  it('is zero for an unknown duration', () => {
    const unknown = { ...phoneClip(), durationSec: null };
    expect(estimateCompressedBytes(unknown, { width: 1280, height: 720 }, 'balanced')).toBe(0);
  });
});

describe('device resolution limit on other re-encodes', () => {
  it('scales a precise trim and an MP4 re-encode down on a low-end phone', () => {
    const clip = { ...phoneClip(), video: { ...phoneClip().video!, codec: 'hevc' } };
    const trim = planJob(
      { kind: 'trim', file: file('a.mov'), info: clip, start: 0, end: 5, mode: 'precise' },
      { maxShortSide: 720 },
    );
    const toMp4 = planJob(
      { kind: 'toMp4', file: file('a.mov'), info: clip },
      { maxShortSide: 720 },
    );
    expect(trim.args(ws)).toContain('scale=1280:720');
    expect(toMp4.args(ws)).toContain('scale=1280:720');
  });

  it('leaves them alone on a capable device', () => {
    const clip = { ...phoneClip(), video: { ...phoneClip().video!, codec: 'hevc' } };
    const toMp4 = planJob({ kind: 'toMp4', file: file('a.mov'), info: clip });
    expect(toMp4.args(ws)).not.toContain('-vf');
  });
});
