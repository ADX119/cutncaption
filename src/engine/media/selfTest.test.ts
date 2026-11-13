import { describe, expect, it } from 'vitest';
import { parseFfmpegVersion } from './selfTest';

describe('parseFfmpegVersion', () => {
  it('reads the version from the banner', () => {
    const log = [
      'ffmpeg version 5.1.4 Copyright (c) 2000-2023 the FFmpeg developers',
      'built with emcc (Emscripten gcc/clang-like replacement + linker emulating GNU ld) 3.1.40',
      'configuration: --target-os=none --arch=x86_32',
    ];
    expect(parseFfmpegVersion(log)).toBe('5.1.4');
  });

  it('handles git-style version strings', () => {
    expect(parseFfmpegVersion(['ffmpeg version n5.1.4-2-gabc123 Copyright'])).toBe(
      'n5.1.4-2-gabc123',
    );
  });

  it('returns undefined when there is no banner', () => {
    expect(parseFfmpegVersion([])).toBeUndefined();
    expect(parseFfmpegVersion(['libavutil 57. 28.100'])).toBeUndefined();
  });
});
