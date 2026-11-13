// Regenerates the media fixtures in tests/fixtures/ and their index.json.
//
//   node scripts/gen-fixtures.mjs
//
// Needs a native ffmpeg: on PATH, or point the FFMPEG environment variable at one.
// The outputs are committed, so this only runs when a fixture has to change.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const FFMPEG = process.env.FFMPEG ?? 'ffmpeg';
const OUT_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'tests', 'fixtures');
const MAX_BYTES = 300 * 1024;

const video = (size, rate, seconds) => [
  '-f',
  'lavfi',
  '-i',
  `testsrc=size=${size}:rate=${rate}:duration=${seconds}`,
];
const tone = (seconds) => ['-f', 'lavfi', '-i', `sine=frequency=440:duration=${seconds}`];
// A keyframe every second, so stream-copy trims have somewhere to cut.
const x264 = (crf, gop = 30) => [
  '-c:v',
  'libx264',
  '-preset',
  'slow',
  '-crf',
  String(crf),
  '-g',
  String(gop),
  '-pix_fmt',
  'yuv420p',
];
const aac = (kbps = 48, channels = 2) => [
  '-c:a',
  'aac',
  '-b:a',
  `${kbps}k`,
  '-ac',
  String(channels),
];

/** `expect` is what the file is meant to be; tests compare the engine's probe against it. */
const FIXTURES = [
  {
    file: 'landscape-720p.mp4',
    args: [
      ...video('1280x720', 30, 5),
      ...tone(5),
      ...x264(32),
      ...aac(),
      '-movflags',
      '+faststart',
    ],
    expect: {
      durationSec: 5,
      width: 1280,
      height: 720,
      fps: 30,
      videoCodec: 'h264',
      audioCodec: 'aac',
    },
  },
  {
    file: 'portrait-720p.mp4',
    args: [
      ...video('720x1280', 30, 5),
      ...tone(5),
      ...x264(32),
      ...aac(),
      '-movflags',
      '+faststart',
    ],
    expect: {
      durationSec: 5,
      width: 720,
      height: 1280,
      fps: 30,
      videoCodec: 'h264',
      audioCodec: 'aac',
    },
  },
  {
    file: 'clip.mov',
    args: [...video('640x360', 30, 3), ...tone(3), ...x264(30), ...aac(), '-f', 'mov'],
    expect: {
      durationSec: 3,
      width: 640,
      height: 360,
      fps: 30,
      videoCodec: 'h264',
      audioCodec: 'aac',
    },
  },
  {
    file: 'clip.webm',
    args: [
      ...video('640x360', 30, 3),
      ...tone(3),
      ...['-c:v', 'libvpx-vp9', '-b:v', '0', '-crf', '40', '-deadline', 'good', '-cpu-used', '4'],
      ...['-c:a', 'libopus', '-b:a', '32k'],
    ],
    expect: {
      durationSec: 3,
      width: 640,
      height: 360,
      fps: 30,
      videoCodec: 'vp9',
      audioCodec: 'opus',
    },
  },
  {
    file: 'clip.mkv',
    args: [...video('640x360', 30, 3), ...tone(3), ...x264(30), '-c:a', 'libopus', '-b:a', '32k'],
    expect: {
      durationSec: 3,
      width: 640,
      height: 360,
      fps: 30,
      videoCodec: 'h264',
      audioCodec: 'opus',
    },
  },
  {
    file: 'clip.avi',
    args: [
      ...video('640x360', 30, 3),
      ...tone(3),
      ...['-c:v', 'mpeg4', '-q:v', '12', '-c:a', 'libmp3lame', '-b:a', '48k'],
    ],
    expect: {
      durationSec: 3,
      width: 640,
      height: 360,
      fps: 30,
      videoCodec: 'mpeg4',
      audioCodec: 'mp3',
    },
  },
  {
    file: 'no-audio.mp4',
    args: [...video('640x360', 30, 3), ...x264(30), '-movflags', '+faststart'],
    expect: {
      durationSec: 3,
      width: 640,
      height: 360,
      fps: 30,
      videoCodec: 'h264',
      audioCodec: null,
    },
  },
  {
    // Long enough for compress-to-size and progress tests, small enough to commit.
    file: 'long-lowres.mp4',
    args: [
      ...video('320x180', 15, 60),
      ...tone(60),
      ...x264(36, 15),
      ...['-c:a', 'aac', '-b:a', '16k', '-ac', '1', '-ar', '22050'],
      ...['-movflags', '+faststart'],
    ],
    expect: {
      durationSec: 60,
      width: 320,
      height: 180,
      fps: 15,
      videoCodec: 'h264',
      audioCodec: 'aac',
    },
  },
  {
    // Stored landscape with a 90° display rotation, as phones record portrait video.
    file: 'rotated.mp4',
    from: 'clip.mov',
    inputArgs: ['-display_rotation:v:0', '90'],
    args: ['-c', 'copy', '-movflags', '+faststart'],
    expect: {
      durationSec: 3,
      width: 640,
      height: 360,
      fps: 30,
      videoCodec: 'h264',
      audioCodec: 'aac',
      rotation: 90,
    },
  },
  {
    file: 'tone.mp3',
    args: [...tone(3), '-c:a', 'libmp3lame', '-b:a', '64k'],
    expect: { durationSec: 3, videoCodec: null, audioCodec: 'mp3' },
  },
];

function ffmpeg(args) {
  const result = spawnSync(FFMPEG, ['-y', '-hide_banner', '-loglevel', 'error', ...args], {
    stdio: ['ignore', 'inherit', 'inherit'],
  });
  if (result.error) {
    console.error(`Could not run "${FFMPEG}". Install ffmpeg or set FFMPEG to its path.`);
    process.exit(1);
  }
  if (result.status !== 0) process.exit(result.status ?? 1);
}

fs.mkdirSync(OUT_DIR, { recursive: true });
const index = [];

for (const fixture of FIXTURES) {
  const out = path.join(OUT_DIR, fixture.file);
  const input = fixture.from
    ? [...(fixture.inputArgs ?? []), '-i', path.join(OUT_DIR, fixture.from)]
    : [];
  // Strip encoder metadata so regenerating does not churn the files needlessly.
  ffmpeg([...input, ...fixture.args, '-map_metadata', '-1', '-fflags', '+bitexact', out]);

  const bytes = fs.statSync(out).size;
  if (bytes > MAX_BYTES) {
    console.error(`${fixture.file} is ${bytes} bytes; the cap is ${MAX_BYTES}.`);
    process.exit(1);
  }
  index.push({ file: fixture.file, bytes, ...fixture.expect });
  console.log(`${fixture.file.padEnd(22)} ${String(bytes).padStart(7)} bytes`);
}

fs.writeFileSync(path.join(OUT_DIR, 'index.json'), `${JSON.stringify(index, null, 2)}\n`);
