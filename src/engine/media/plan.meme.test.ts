import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import type { MemeJob } from './jobs';
import type { Workspace } from './ffmpeg/workspace';
import { planJob } from './plan';
import { type MediaInfo, parseProbe } from './probe/parse';

const recording = (name: string) =>
  parseProbe(fs.readFileSync(path.join(__dirname, 'probe', 'recordings', `${name}.json`), 'utf8'));

const WS = {
  input: () => '/job1/in/input0.mp4',
  path: (name: string) => `/job1/${name}`,
} as unknown as Workspace;

const file = { name: 'cat video.mp4', size: 2_000_000, type: 'video/mp4' } as File;

function meme(info: MediaInfo, overrides: Partial<MemeJob> = {}): MemeJob {
  return {
    kind: 'meme',
    file,
    info,
    start: 1,
    end: 4,
    layout: 'top-bottom',
    text: { top: 'top', bottom: 'bottom' },
    textScale: 1,
    format: 'mp4',
    ...overrides,
  };
}

const LANDSCAPE = recording('landscape-720p.mp4');
const OVERLAY = {
  frame: { width: 1280, height: 720 },
  video: { x: 0, y: 0, width: 1280, height: 720 },
};

describe('planJob: meme, top and bottom text to MP4', () => {
  it('lays the caption PNG over the moment, re-encoded to H.264 and AAC', () => {
    const plan = planJob(meme(LANDSCAPE));
    expect(plan.args(WS, OVERLAY)).toEqual([
      '-hide_banner',
      '-ss',
      '1',
      '-t',
      '3',
      '-i',
      '/job1/in/input0.mp4',
      '-i',
      '/job1/ov.png',
      '-filter_complex',
      '[0:v]scale=1280:720,setsar=1[v];[v][1:v]overlay=0:0[out]',
      '-map',
      '[out]',
      '-map',
      '0:a:0',
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

  it('asks the engine for a caption layer the size of the output video', () => {
    const plan = planJob(meme(LANDSCAPE, { textScale: 1.2 }));
    expect(plan.overlay).toEqual({
      layout: 'top-bottom',
      video: { width: 1280, height: 720 },
      text: { top: 'top', bottom: 'bottom' },
      textScale: 1.2,
    });
  });

  it('scales to the device cap, and the caption layer with it', () => {
    const hd = recording('hq-1080p.mp4');
    const plan = planJob(meme(hd), { maxShortSide: 720 });
    expect(plan.overlay?.video).toEqual({ width: 1280, height: 720 });
    expect(plan.args(WS, OVERLAY)).toContain(
      '[0:v]scale=1280:720,setsar=1[v];[v][1:v]overlay=0:0[out]',
    );
  });

  it('works on the picture as shown, so phone video stays upright', () => {
    const rotated = recording('rotated.mp4');
    const plan = planJob(meme(rotated));
    expect(plan.overlay?.video).toEqual({ width: 360, height: 640 });
  });

  it('leaves out audio when the video has none', () => {
    const args = planJob(meme(recording('no-audio.mp4'))).args(WS, OVERLAY);
    expect(args).toContain('-an');
    expect(args).not.toContain('0:a:0');
    expect(args).not.toContain('aac');
  });

  it('names the result, expects the moment’s length, and counts it as a re-encode', () => {
    const plan = planJob(meme(LANDSCAPE, { start: 0.5, end: 2.75 }));
    expect(plan).toMatchObject({
      path: 'ffmpeg',
      reencodesVideo: true,
      outputName: 'out.mp4',
      mime: 'video/mp4',
      filename: 'cat video-meme.mp4',
      expectedDurationSec: 2.25,
    });
    expect(plan.footprint.reencodeSeconds).toBe(2.25);
    expect(plan.args(WS, OVERLAY).slice(1, 5)).toEqual(['-ss', '0.5', '-t', '2.25']);
  });

  it('refuses a file with no picture', () => {
    expect(planJob(meme(recording('tone.mp3'))).refusal).toEqual({ code: 'no-video' });
  });
});
