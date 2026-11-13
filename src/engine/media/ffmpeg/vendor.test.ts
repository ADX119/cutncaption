import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import vendor from './vendor.json';

const root = process.cwd();
const installed = (name: string): string =>
  JSON.parse(fs.readFileSync(path.join(root, 'node_modules', name, 'package.json'), 'utf8'))
    .version;
const publicFile = (urlPath: string) => path.join(root, 'public', urlPath);

describe('ffmpeg vendor files (scripts/vendor-copy.mjs)', () => {
  it('match the installed package versions', () => {
    expect(vendor.wrapperVersion).toBe(installed('@ffmpeg/ffmpeg'));
    expect(vendor.coreVersion).toBe(installed('@ffmpeg/core'));
    expect(vendor.coreVersion).toBe(installed('@ffmpeg/core-mt'));
    expect(vendor.vendorBase).toBe(`/vendor/ffmpeg/${vendor.wrapperVersion}_${vendor.coreVersion}`);
    expect(vendor.assetPrefix).toBe(`ffmpeg/${vendor.coreVersion}`);
  });

  it.each([
    'class/worker.js',
    'class/const.js',
    'class/errors.js',
    'st/ffmpeg-core.js',
    'mt/ffmpeg-core.js',
    'mt/ffmpeg-core.worker.js',
  ])('has %s on the site origin', (file) => {
    expect(fs.existsSync(publicFile(`${vendor.vendorBase}/${file}`))).toBe(true);
  });

  it('keeps only the current version', () => {
    const folders = fs.readdirSync(publicFile('/vendor/ffmpeg'));
    expect(folders).toEqual([`${vendor.wrapperVersion}_${vendor.coreVersion}`]);
  });

  it('the wrapper worker only imports files that were copied with it', () => {
    const source = fs.readFileSync(publicFile(`${vendor.vendorBase}/class/worker.js`), 'utf8');
    const imports = [...source.matchAll(/from\s+"(\.[^"]+)"/g)].map((match) => match[1]);
    expect(imports.sort()).toEqual(['./const.js', './errors.js']);
  });

  it('has the wasm files for the dev server, and they are excluded from deployment', () => {
    for (const variant of ['st', 'mt']) {
      const wasm = publicFile(`/assets/${vendor.assetPrefix}/${variant}/ffmpeg-core.wasm`);
      expect(fs.statSync(wasm).size).toBeGreaterThan(25 * 1024 * 1024);
    }
    const ignore = fs.readFileSync(publicFile('/.assetsignore'), 'utf8');
    expect(ignore.split(/\r?\n/)).toContain('assets/');
  });
});
