import { describe, expect, it } from 'vitest';
import manifest from '../../assets/manifest.json';
import { coreLocation } from './loader';
import vendor from './vendor.json';

const ORIGIN = 'https://site.test';

describe('coreLocation', () => {
  it('points the single-thread core at same-origin scripts and a manifest wasm', () => {
    const location = coreLocation('st', ORIGIN);
    expect(location).toEqual({
      wrapperURL: `${ORIGIN}${vendor.vendorBase}/class/index.js`,
      coreURL: `${ORIGIN}${vendor.vendorBase}/st/ffmpeg-core.js`,
      workerURL: undefined,
      wasmKey: `${vendor.assetPrefix}/st/ffmpeg-core.wasm`,
    });
    expect(manifest).toHaveProperty([location.wasmKey]);
  });

  it('adds the thread worker for the multi-thread core', () => {
    const location = coreLocation('mt', ORIGIN);
    expect(location.coreURL).toBe(`${ORIGIN}${vendor.vendorBase}/mt/ffmpeg-core.js`);
    expect(location.workerURL).toBe(`${ORIGIN}${vendor.vendorBase}/mt/ffmpeg-core.worker.js`);
    expect(manifest).toHaveProperty([location.wasmKey]);
  });

  it('never points at a third-party host', () => {
    for (const variant of ['st', 'mt'] as const) {
      const { wrapperURL, coreURL, workerURL } = coreLocation(variant, ORIGIN);
      for (const url of [wrapperURL, coreURL, workerURL]) {
        if (url) expect(new URL(url).origin).toBe(ORIGIN);
      }
    }
  });
});
