import { afterEach, describe, expect, it, vi } from 'vitest';
import manifest from '../../assets/manifest.json';
import { EngineError } from '../../errors';
import { MT_START_TIMEOUT_MS, coreLocation, startWithin } from './loader';
import vendor from './vendor.json';

describe('startWithin', () => {
  afterEach(() => vi.useRealTimers());

  it('passes a start that finishes in time straight through', async () => {
    await expect(startWithin(Promise.resolve('ready'), 1000, 'core')).resolves.toBe('ready');
  });

  it('gives up with "stalled" when the start takes too long', async () => {
    vi.useFakeTimers();
    const never = new Promise<never>(() => undefined);
    const result = startWithin(never, MT_START_TIMEOUT_MS, 'the multi-thread core').catch(
      (error: unknown) => error,
    );
    await vi.advanceTimersByTimeAsync(MT_START_TIMEOUT_MS - 1);
    vi.advanceTimersByTime(1);
    const error = await result;
    expect(error).toBeInstanceOf(EngineError);
    expect(error).toMatchObject({ code: 'stalled' });
    expect((error as EngineError).detail).toContain('30 s');
  });

  it('leaves no timer behind', async () => {
    vi.useFakeTimers();
    await startWithin(Promise.resolve(1), 1000, 'core');
    expect(vi.getTimerCount()).toBe(0);
  });
});

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
