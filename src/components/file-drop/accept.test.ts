import { describe, expect, it } from 'vitest';
import { MEDIA_ACCEPT, VIDEO_ACCEPT, matchesAccept, pickFile, toAcceptAttribute } from './accept';

const file = (name: string, type = '', size = 1000) => ({ name, type, size });

describe('matchesAccept', () => {
  it.each([
    ['clip.mp4', 'video/mp4'],
    ['CLIP.MOV', 'video/quicktime'],
    ['movie.mkv', ''], // some systems report no type for MKV
    ['shared-video', 'video/webm'], // no extension, e.g. from a share sheet
  ])('accepts %s as video', (name, type) => {
    expect(matchesAccept(file(name, type), VIDEO_ACCEPT)).toBe(true);
  });

  it.each([
    ['notes.txt', 'text/plain'],
    ['photo.jpg', 'image/jpeg'],
    ['song.mp3', 'audio/mpeg'],
    ['mp4', ''],
  ])('rejects %s as video', (name, type) => {
    expect(matchesAccept(file(name, type), VIDEO_ACCEPT)).toBe(false);
  });

  it('accepts audio when the tool takes media', () => {
    expect(matchesAccept(file('song.mp3', 'audio/mpeg'), MEDIA_ACCEPT)).toBe(true);
    expect(matchesAccept(file('voice.m4a'), MEDIA_ACCEPT)).toBe(true);
  });
});

describe('toAcceptAttribute', () => {
  it('lists MIME wildcards and extensions', () => {
    expect(toAcceptAttribute(VIDEO_ACCEPT)).toBe('video/*,.mp4,.mov,.webm,.mkv,.avi,.m4v');
  });
});

describe('pickFile', () => {
  it('takes a single matching file', () => {
    const clip = file('clip.mp4', 'video/mp4');
    expect(pickFile([clip], VIDEO_ACCEPT)).toEqual({ ok: true, file: clip });
  });

  it('rejects a drop with no files (a dragged link or text)', () => {
    expect(pickFile([], VIDEO_ACCEPT)).toEqual({ ok: false, reason: 'not-a-file' });
  });

  it('rejects more than one file', () => {
    const clips = [file('a.mp4', 'video/mp4'), file('b.mp4', 'video/mp4')];
    expect(pickFile(clips, VIDEO_ACCEPT)).toEqual({ ok: false, reason: 'too-many' });
  });

  it('rejects the wrong type', () => {
    expect(pickFile([file('notes.txt', 'text/plain')], VIDEO_ACCEPT)).toEqual({
      ok: false,
      reason: 'wrong-type',
    });
  });

  it('rejects an empty file', () => {
    expect(pickFile([file('clip.mp4', 'video/mp4', 0)], VIDEO_ACCEPT)).toEqual({
      ok: false,
      reason: 'empty',
    });
  });
});
