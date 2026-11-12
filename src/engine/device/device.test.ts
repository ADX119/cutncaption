import { describe, expect, it } from 'vitest';
import {
  type Capabilities,
  type DeviceEnv,
  LIMITS,
  checkLimits,
  clampShortSide,
  classifyDevice,
  detectCapabilities,
  detectInAppBrowser,
  isIos,
  missingRequirements,
} from '.';

const UA = {
  chromeDesktop:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36',
  chromeAndroid:
    'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36',
  iphone:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
  macSafari:
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15',
  instagram:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 350.0.0.0',
  facebook:
    'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36 [FB_IAB/FB4A;FBAV/480.0.0.0;]',
  tiktok:
    'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36 musical_ly_2023 BytedanceWebview/d8a21c6',
};

function env(userAgent: string, rest: Partial<DeviceEnv> = {}): DeviceEnv {
  return { userAgent, maxTouchPoints: 0, ...rest };
}

describe('platform', () => {
  it('detects iPhone and iPadOS-as-Mac, but not a real Mac', () => {
    expect(isIos(env(UA.iphone, { maxTouchPoints: 5 }))).toBe(true);
    expect(isIos(env(UA.macSafari, { maxTouchPoints: 5 }))).toBe(true);
    expect(isIos(env(UA.macSafari))).toBe(false);
  });

  it.each([
    ['instagram', UA.instagram],
    ['facebook', UA.facebook],
    ['tiktok', UA.tiktok],
  ] as const)('detects the %s in-app browser', (name, ua) => {
    expect(detectInAppBrowser(env(ua))).toBe(name);
  });

  it('does not flag normal browsers as in-app', () => {
    for (const ua of [UA.chromeDesktop, UA.chromeAndroid, UA.iphone, UA.macSafari]) {
      expect(detectInAppBrowser(env(ua))).toBeNull();
    }
  });
});

describe('classifyDevice', () => {
  it.each<[string, DeviceEnv, 'L' | 'M' | 'H']>([
    ['low-memory Android', env(UA.chromeAndroid, { deviceMemory: 2, hardwareConcurrency: 8 }), 'L'],
    ['few-core Android', env(UA.chromeAndroid, { deviceMemory: 4, hardwareConcurrency: 4 }), 'L'],
    ['mid Android', env(UA.chromeAndroid, { deviceMemory: 4, hardwareConcurrency: 8 }), 'M'],
    ['flagship Android', env(UA.chromeAndroid, { deviceMemory: 8, hardwareConcurrency: 8 }), 'H'],
    ['Android, nothing reported', env(UA.chromeAndroid), 'M'],
    ['iPhone', env(UA.iphone, { maxTouchPoints: 5, hardwareConcurrency: 6 }), 'M'],
    ['iPad with Mac UA', env(UA.macSafari, { maxTouchPoints: 5, hardwareConcurrency: 8 }), 'M'],
    ['desktop', env(UA.chromeDesktop, { deviceMemory: 8, hardwareConcurrency: 12 }), 'H'],
    ['desktop, nothing reported', env(UA.macSafari), 'H'],
    ['low-memory desktop', env(UA.chromeDesktop, { deviceMemory: 2, hardwareConcurrency: 2 }), 'M'],
  ])('%s -> %s', (_name, deviceEnv, expected) => {
    expect(classifyDevice(deviceEnv)).toBe(expected);
  });
});

describe('limits', () => {
  it('get looser with each class', () => {
    for (const key of [
      'maxInputBytes',
      'maxOutputBytes',
      'maxReencodeSeconds',
      'maxEncodeShortSide',
      'maxCaptionAudioSeconds',
    ] as const) {
      expect(LIMITS.L[key], key).toBeLessThanOrEqual(LIMITS.M[key]);
      expect(LIMITS.M[key], key).toBeLessThanOrEqual(LIMITS.H[key]);
    }
  });

  it('offers Whisper small only on class H', () => {
    expect(LIMITS.L.whisperTiers).toEqual(['base']);
    expect(LIMITS.M.whisperTiers).toEqual(['base']);
    expect(LIMITS.H.whisperTiers).toContain('small');
  });

  it('passes a job inside every limit', () => {
    expect(
      checkLimits('L', { inputBytes: 1, estimatedOutputBytes: 1, reencodeSeconds: 1 }),
    ).toEqual({ blocks: [], warnings: [] });
  });

  it('allows a value exactly at the limit', () => {
    const { blocks } = checkLimits('L', { inputBytes: LIMITS.L.maxInputBytes });
    expect(blocks).toEqual([]);
  });

  it.each([
    ['input-too-large', { inputBytes: LIMITS.L.maxInputBytes + 1 }],
    ['output-too-large', { inputBytes: 1, estimatedOutputBytes: LIMITS.L.maxOutputBytes + 1 }],
    [
      'caption-audio-too-long',
      { inputBytes: 1, captionAudioSeconds: LIMITS.L.maxCaptionAudioSeconds + 1 },
    ],
  ] as const)('hard limit: blocks %s', (code, job) => {
    const { blocks, warnings } = checkLimits('L', job);
    expect(blocks.map((issue) => issue.code)).toEqual([code]);
    expect(warnings).toEqual([]);
  });

  it('warn limit: a long re-encode warns but does not block', () => {
    const seconds = LIMITS.L.maxReencodeSeconds + 1;
    const { blocks, warnings } = checkLimits('L', { inputBytes: 1, reencodeSeconds: seconds });
    expect(blocks).toEqual([]);
    expect(warnings).toEqual([
      { code: 'reencode-too-long', limit: LIMITS.L.maxReencodeSeconds, actual: seconds },
    ]);
  });

  it('applies the limits of the given class', () => {
    const job = { inputBytes: LIMITS.L.maxInputBytes + 1 };
    expect(checkLimits('L', job).blocks).toHaveLength(1);
    expect(checkLimits('H', job).blocks).toHaveLength(0);
  });

  it('clamp limit: caps the short side and never upscales', () => {
    expect(clampShortSide('L', 1080)).toBe(720);
    expect(clampShortSide('H', 2160)).toBe(1080);
    expect(clampShortSide('L', 480)).toBe(480);
  });
});

describe('capabilities', () => {
  it('reports nothing for an empty scope', () => {
    const caps = detectCapabilities({});
    expect(Object.values(caps).every((value) => value === false)).toBe(true);
    expect(missingRequirements(caps)).toEqual(['wasm', 'workers', 'cache-storage']);
  });

  it('detects features from the scope it is given', () => {
    const caps = detectCapabilities({
      WebAssembly,
      Worker: function Worker() {},
      caches: {},
      SharedArrayBuffer,
      crossOriginIsolated: true,
      VideoEncoder: function VideoEncoder() {},
      navigator: { gpu: {} },
    });
    expect(caps).toEqual<Capabilities>({
      wasm: true,
      wasmSimd: true,
      workers: true,
      cacheStorage: true,
      sharedArrayBuffer: true,
      crossOriginIsolated: true,
      webCodecsVideoEncode: true,
      webCodecsAudioEncode: false,
      webGpuApi: true,
    });
    expect(missingRequirements(caps)).toEqual([]);
  });

  it('reports missing SIMD separately from missing WebAssembly', () => {
    const caps = detectCapabilities({
      WebAssembly: { validate: () => false },
      Worker: function Worker() {},
      caches: {},
    });
    expect(missingRequirements(caps)).toEqual(['wasm-simd']);
  });
});
