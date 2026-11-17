import { describe, expect, it } from 'vitest';
import {
  type CapabilitySet,
  REQUIRED_CAPABILITIES,
  missingCapabilities,
  parseCapabilityLog,
  parseCodecList,
  parseFilterList,
  parseFormatList,
} from './capabilities';

// Excerpts in the exact shape ffmpeg 5.x prints them.
const ENCODERS = [
  'Encoders:',
  ' V..... = Video',
  ' A..... = Audio',
  ' S..... = Subtitle',
  ' .F.... = Frame-level multithreading',
  ' ------',
  ' V....D gif                  GIF (Graphics Interchange Format)',
  ' V....D libx264              libx264 H.264 / AVC / MPEG-4 AVC / MPEG-4 part 10 (codec h264)',
  ' V....D libwebp_anim         libwebp WebP image (codec webp)',
  ' A....D aac                  AAC (Advanced Audio Coding)',
  ' A....D libmp3lame           libmp3lame MP3 (MPEG audio layer 3) (codec mp3)',
];

const FILTERS = [
  'Filters:',
  '  T.. = Timeline support',
  '  .S. = Slice threading',
  '  ..C = Command support',
  '  A = Audio input/output',
  '  | = Source or sink filter',
  ' ... apad              A->A       Pad audio with silence.',
  ' TSC scale             V->V       Scale the input video size and/or convert the image format.',
  ' ... concat            N->N       Concatenate audio and video streams.',
  ' ... zoompan           V->V       Apply Zoom & Pan effect.',
  ' ... subtitles         V->V       Render text subtitles onto input video using the libass library.',
  ' ... split             V->N       Pass on the input to several outputs.',
];

const DEMUXERS = [
  'File formats:',
  ' D. = Demuxing supported',
  ' .E = Muxing supported',
  ' --',
  ' D  avi             AVI (Audio Video Interleaved)',
  ' D  matroska,webm   Matroska / WebM',
  ' D  mov,mp4,m4a,3gp,3g2,mj2 QuickTime / MOV',
];

const MUXERS = [
  'File formats:',
  ' D. = Demuxing supported',
  ' .E = Muxing supported',
  ' --',
  '  E mp4             MP4 (MPEG-4 Part 14)',
  '  E f32le           PCM 32-bit floating-point little-endian',
  '  E webm            WebM',
];

describe('parsers', () => {
  it('reads codec names after the separator and skips the legend', () => {
    const names = parseCodecList(ENCODERS);
    expect([...names].sort()).toEqual(['aac', 'gif', 'libmp3lame', 'libwebp_anim', 'libx264']);
  });

  it('reads filter names and skips the legend', () => {
    expect([...parseFilterList(FILTERS)].sort()).toEqual([
      'apad',
      'concat',
      'scale',
      'split',
      'subtitles',
      'zoompan',
    ]);
  });

  it('splits demuxers that list several names', () => {
    const names = parseFormatList(DEMUXERS);
    for (const name of ['avi', 'matroska', 'webm', 'mov', 'mp4', 'm4a']) {
      expect(names.has(name), name).toBe(true);
    }
    expect(names.has('D')).toBe(false);
  });

  it('reads muxers', () => {
    expect([...parseFormatList(MUXERS)].sort()).toEqual(['f32le', 'mp4', 'webm']);
  });

  it('picks the parser by kind', () => {
    expect(parseCapabilityLog('filter', FILTERS).has('zoompan')).toBe(true);
    expect(parseCapabilityLog('encoder', ENCODERS).has('libx264')).toBe(true);
    expect(parseCapabilityLog('demuxer', DEMUXERS).has('mp4')).toBe(true);
  });

  it('returns nothing for empty output', () => {
    expect(parseCodecList([]).size).toBe(0);
    expect(parseFormatList(['File formats:']).size).toBe(0);
  });
});

describe('missingCapabilities', () => {
  const everything = (): CapabilitySet => {
    const sets = {
      encoder: new Set<string>(),
      decoder: new Set<string>(),
      filter: new Set<string>(),
      muxer: new Set<string>(),
      demuxer: new Set<string>(),
    };
    for (const requirement of REQUIRED_CAPABILITIES) {
      sets[requirement.kind].add(requirement.anyOf[0] ?? '');
    }
    return sets;
  };

  it('is empty when every requirement is met', () => {
    expect(missingCapabilities(everything())).toEqual([]);
  });

  it('accepts any of the alternatives', () => {
    const sets = everything();
    (sets.encoder as Set<string>).delete('libwebp_anim');
    (sets.encoder as Set<string>).add('libwebp');
    expect(missingCapabilities(sets)).toEqual([]);
  });

  it('names what is missing', () => {
    const sets = everything();
    (sets.decoder as Set<string>).delete('hevc');
    (sets.filter as Set<string>).delete('subtitles');
    expect(missingCapabilities(sets)).toEqual(['decoder hevc', 'filter subtitles']);
  });

  it('has no duplicate requirements', () => {
    const keys = REQUIRED_CAPABILITIES.map((r) => `${r.kind}:${r.anyOf.join('/')}`);
    expect(new Set(keys).size).toBe(keys.length);
  });
});
