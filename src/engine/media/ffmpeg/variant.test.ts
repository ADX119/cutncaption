import { describe, expect, it } from 'vitest';
import { type VariantInput, chooseCoreVariant, limitThreads, threadCount } from './variant';

const capable: VariantInput = {
  capabilities: { crossOriginIsolated: true, sharedArrayBuffer: true },
  deviceClass: 'H',
  ios: false,
  reencodesVideo: true,
};

describe('chooseCoreVariant', () => {
  it('uses the multi-thread core for a re-encode on a capable desktop', () => {
    expect(chooseCoreVariant(capable)).toBe('mt');
  });

  it('uses it on a mid-range Android phone too', () => {
    expect(chooseCoreVariant({ ...capable, deviceClass: 'M' })).toBe('mt');
  });

  it.each<[string, Partial<VariantInput>]>([
    ['stream copies', { reencodesVideo: false }],
    [
      'pages that are not isolated',
      { capabilities: { crossOriginIsolated: false, sharedArrayBuffer: true } },
    ],
    [
      'browsers without SharedArrayBuffer',
      { capabilities: { crossOriginIsolated: true, sharedArrayBuffer: false } },
    ],
    ['iPhone and iPad', { ios: true, deviceClass: 'M' }],
    ['low-end phones', { deviceClass: 'L' }],
    ['the rest of a visit after a stall', { multiThreadDisabled: true }],
  ])('uses the single-thread core for %s', (_name, change) => {
    expect(chooseCoreVariant({ ...capable, ...change })).toBe('st');
  });
});

describe('limitThreads', () => {
  it('states the thread count for decoders, the encoder and filter graphs', () => {
    expect(limitThreads(['-i', 'in.mp4', '-c:v', 'libx264', 'out.mp4'], 4)).toEqual([
      '-filter_threads',
      '4',
      '-filter_complex_threads',
      '4',
      '-threads',
      '4',
      '-i',
      'in.mp4',
      '-c:v',
      'libx264',
      '-threads',
      '4',
      'out.mp4',
    ]);
  });

  it('covers every input of a multi-input command', () => {
    const args = limitThreads(['-i', 'a.mp4', '-i', 'ov.png', '-filter_complex', 'x', 'o.mp4'], 2);
    expect(args.filter((a) => a === '-threads')).toHaveLength(3);
    expect(args.indexOf('a.mp4') - args.indexOf('-threads')).toBe(3);
  });

  it('leaves an empty command empty', () => {
    expect(limitThreads([], 4)).toEqual([]);
  });
});

describe('threadCount', () => {
  it.each([
    [undefined, 1],
    [0, 1],
    [2, 2],
    [4, 4],
    [16, 4],
  ])('%s cores -> %d threads', (cores, expected) => {
    expect(threadCount(cores)).toBe(expected);
  });
});
