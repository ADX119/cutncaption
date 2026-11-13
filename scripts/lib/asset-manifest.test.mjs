import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import committed from '../../src/engine/assets/manifest.json';
import { buildManifest, contentTypeFor, listAssets } from './asset-manifest.mjs';

let dir;

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cnc-assets-'));
});
afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true });
});

function write(relative, content) {
  const full = path.join(dir, relative);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content);
}

describe('listAssets', () => {
  it('walks folders and returns sorted forward-slash keys', () => {
    write('ffmpeg/1.0/st/core.wasm', 'a');
    write('ffmpeg/1.0/mt/core.wasm', 'b');
    write('models/x/config.json', '{}');
    expect(listAssets(dir)).toEqual([
      'ffmpeg/1.0/mt/core.wasm',
      'ffmpeg/1.0/st/core.wasm',
      'models/x/config.json',
    ]);
  });

  it('returns nothing for a missing folder', () => {
    expect(listAssets(path.join(dir, 'nope'))).toEqual([]);
  });
});

describe('buildManifest', () => {
  it('records size and SHA-256 for each file', () => {
    write('a/hello.txt', 'hello');
    expect(buildManifest(dir)).toEqual({
      'a/hello.txt': {
        bytes: 5,
        // sha256("hello")
        sha256: '2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824',
      },
    });
  });

  it('changes when a file changes', () => {
    write('a.bin', 'one');
    const before = buildManifest(dir)['a.bin'].sha256;
    write('a.bin', 'two');
    expect(buildManifest(dir)['a.bin'].sha256).not.toBe(before);
  });
});

describe('contentTypeFor', () => {
  it('serves wasm with the type browsers need for streaming compilation', () => {
    expect(contentTypeFor('ffmpeg/0.12.10/st/ffmpeg-core.wasm')).toBe('application/wasm');
    expect(contentTypeFor('models/x/model.onnx')).toBe('application/octet-stream');
    expect(contentTypeFor('models/x/unknown.xyz')).toBe('application/octet-stream');
  });
});

describe('committed manifest', () => {
  it('matches the files that are installed', () => {
    const installed = buildManifest(path.join(process.cwd(), 'public', 'assets'));
    expect(committed).toEqual(installed);
  });
});
