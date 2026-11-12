import { describe, expect, it } from 'vitest';
import type { Capabilities } from './capabilities';
import { assessBrowser } from './support';

const CAPABLE: Capabilities = {
  wasm: true,
  wasmSimd: true,
  workers: true,
  cacheStorage: true,
  sharedArrayBuffer: true,
  crossOriginIsolated: true,
  webCodecsVideoEncode: true,
  webCodecsAudioEncode: true,
  webGpuApi: true,
};
const CHROME = { userAgent: 'Mozilla/5.0 (Windows NT 10.0) Chrome/140.0.0.0', maxTouchPoints: 0 };
const INSTAGRAM = { userAgent: 'Mozilla/5.0 (iPhone) Instagram 350.0.0.0', maxTouchPoints: 5 };

describe('assessBrowser', () => {
  it('passes a capable browser', () => {
    expect(assessBrowser(CHROME, CAPABLE)).toEqual({ status: 'ok' });
  });

  it('does not require the optional fast paths', () => {
    const basic: Capabilities = {
      ...CAPABLE,
      sharedArrayBuffer: false,
      crossOriginIsolated: false,
      webCodecsVideoEncode: false,
      webCodecsAudioEncode: false,
      webGpuApi: false,
    };
    expect(assessBrowser(CHROME, basic)).toEqual({ status: 'ok' });
  });

  it('blocks in-app browsers', () => {
    expect(assessBrowser(INSTAGRAM, CAPABLE)).toEqual({ status: 'in-app', app: 'instagram' });
  });

  it('lists what an unsupported browser is missing', () => {
    expect(assessBrowser(CHROME, { ...CAPABLE, cacheStorage: false, workers: false })).toEqual({
      status: 'unsupported',
      missing: ['workers', 'cache-storage'],
    });
  });

  it('reports the in-app browser first when both apply', () => {
    expect(assessBrowser(INSTAGRAM, { ...CAPABLE, wasm: false }).status).toBe('in-app');
  });
});
