import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import index from './fixtures/index.json';

const DIR = path.join(process.cwd(), 'tests', 'fixtures');
const MAX_BYTES = 300 * 1024;

describe('media fixtures (scripts/gen-fixtures.mjs)', () => {
  it('cover every input kind the tools must handle', () => {
    expect(index.map((fixture) => fixture.file).sort()).toEqual(
      [
        'clip.avi',
        'clip.mkv',
        'clip.mov',
        'clip.webm',
        'hq-1080p.mp4',
        'landscape-720p.mp4',
        'long-lowres.mp4',
        'long-tiny.mp4',
        'no-audio.mp4',
        'portrait-720p.mp4',
        'rotated.mp4',
        'tone.mp3',
      ].sort(),
    );
  });

  it.each(index)('$file exists, matches the index and is small enough to commit', (fixture) => {
    const { size } = fs.statSync(path.join(DIR, fixture.file));
    expect(size).toBe(fixture.bytes);
    expect(size).toBeLessThanOrEqual(MAX_BYTES);
    expect(fixture.durationSec).toBeGreaterThan(0);
  });

  it('has no stray files', () => {
    const listed = new Set([...index.map((fixture) => fixture.file), 'index.json']);
    expect(fs.readdirSync(DIR).filter((name) => !listed.has(name))).toEqual([]);
  });

  it('includes silent videos and an audio-only file', () => {
    expect(index.filter((f) => f.videoCodec && !f.audioCodec).map((f) => f.file)).toContain(
      'no-audio.mp4',
    );
    expect(index.filter((f) => !f.videoCodec && f.audioCodec).map((f) => f.file)).toEqual([
      'tone.mp3',
    ]);
  });
});
