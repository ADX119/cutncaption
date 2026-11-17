import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import index from '../../../../tests/fixtures/index.json';
import { normaliseRotation, parseClock, parseProbe, parseRate } from './parse';

// Real ffprobe output for each fixture, recorded with a native ffprobe.
const recording = (file: string) =>
  fs.readFileSync(path.join(__dirname, 'recordings', `${file}.json`), 'utf8');

describe('parseProbe on every fixture', () => {
  it.each(index)('$file matches what it was generated as', (fixture) => {
    const info = parseProbe(recording(fixture.file));

    expect(info.durationSec).toBeCloseTo(fixture.durationSec, 1);
    if (fixture.videoCodec) {
      expect(info.video?.codec).toBe(fixture.videoCodec);
      expect(info.video?.width).toBe(fixture.width);
      expect(info.video?.height).toBe(fixture.height);
      expect(info.video?.fps).toBe(fixture.fps);
    } else {
      expect(info.video).toBeNull();
    }
    if (fixture.audioCodec) expect(info.audio?.codec).toBe(fixture.audioCodec);
    else expect(info.audio).toBeNull();
  });

  it('turns a rotated phone video the right way round', () => {
    const info = parseProbe(recording('rotated.mp4'));
    expect(info.video).toMatchObject({
      width: 640,
      height: 360,
      displayWidth: 360,
      displayHeight: 640,
    });
    expect([90, 270]).toContain(info.video?.rotation);
  });

  it('reads audio details', () => {
    expect(parseProbe(recording('long-lowres.mp4')).audio).toEqual({
      codec: 'aac',
      channels: 1,
      sampleRate: 22050,
    });
  });

  it('names the container', () => {
    expect(parseProbe(recording('clip.mov')).container).toContain('mov');
    expect(parseProbe(recording('clip.webm')).container).toContain('webm');
  });
});

describe('edge cases', () => {
  it('ignores cover art in an audio file', () => {
    const json = JSON.stringify({
      format: { format_name: 'mp3', duration: '10' },
      streams: [
        { codec_type: 'audio', codec_name: 'mp3', channels: 2, sample_rate: '44100' },
        {
          codec_type: 'video',
          codec_name: 'mjpeg',
          width: 500,
          height: 500,
          disposition: { attached_pic: 1 },
        },
      ],
    });
    expect(parseProbe(json).video).toBeNull();
  });

  it('falls back to stream durations, then the Matroska tag, then null', () => {
    const streams = (s: object[]) => JSON.stringify({ format: { format_name: 'x' }, streams: s });
    expect(parseProbe(streams([{ codec_type: 'audio', duration: '4.5' }])).durationSec).toBe(4.5);
    expect(
      parseProbe(streams([{ codec_type: 'audio', tags: { DURATION: '00:01:02.500000000' } }]))
        .durationSec,
    ).toBe(62.5);
    expect(parseProbe(streams([{ codec_type: 'audio' }])).durationSec).toBeNull();
  });

  it('reads the old rotate tag', () => {
    const json = JSON.stringify({
      format: { format_name: 'mov', duration: '1' },
      streams: [
        {
          codec_type: 'video',
          codec_name: 'h264',
          width: 1920,
          height: 1080,
          tags: { rotate: '90' },
        },
      ],
    });
    expect(parseProbe(json).video).toMatchObject({ rotation: 90, displayWidth: 1080 });
  });

  it('refuses something that is not ffprobe output', () => {
    expect(() => parseProbe('{}')).toThrow();
    expect(() => parseProbe('not json')).toThrow();
  });
});

describe('helpers', () => {
  it.each([
    ['30/1', 30],
    ['30000/1001', 29.97],
    ['0/0', null],
    [undefined, null],
  ])('parseRate(%s) = %s', (rate, expected) => {
    expect(parseRate(rate)).toBe(expected);
  });

  it.each([
    [-90, 270],
    [90, 90],
    [270, 270],
    [-270, 90],
    [180, 180],
    [-180, 180],
    [360, 0],
    [89.9, 90],
  ])('normaliseRotation(%d) = %d', (degrees, expected) => {
    expect(normaliseRotation(degrees)).toBe(expected);
  });

  it('parses Matroska clock tags', () => {
    expect(parseClock('01:00:00.000000000')).toBe(3600);
    expect(parseClock('nonsense')).toBeNull();
  });
});
