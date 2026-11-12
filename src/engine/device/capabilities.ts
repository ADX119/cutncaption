/** What the current browser can do. Always feature-detected, never inferred from the user agent. */
export interface Capabilities {
  readonly wasm: boolean;
  readonly wasmSimd: boolean;
  readonly workers: boolean;
  readonly cacheStorage: boolean;
  readonly sharedArrayBuffer: boolean;
  readonly crossOriginIsolated: boolean;
  readonly webCodecsVideoEncode: boolean;
  readonly webCodecsAudioEncode: boolean;
  /** `navigator.gpu` exists. Whether an adapter is available is checked later, asynchronously. */
  readonly webGpuApi: boolean;
}

// Smallest module that uses a SIMD instruction (from wasm-feature-detect).
const SIMD_PROBE = new Uint8Array([
  0, 97, 115, 109, 1, 0, 0, 0, 1, 5, 1, 96, 0, 1, 123, 3, 2, 1, 0, 10, 10, 1, 8, 0, 65, 0, 253, 15,
  253, 98, 11,
]);

type Scope = Record<string, unknown> & { navigator?: unknown };

export function detectCapabilities(scope: Scope = globalThis as Scope): Capabilities {
  const wasmApi = scope.WebAssembly as typeof WebAssembly | undefined;
  const wasm = typeof wasmApi?.validate === 'function';
  const nav = (scope.navigator ?? {}) as Record<string, unknown>;

  return {
    wasm,
    wasmSimd: wasm && wasmApi.validate(SIMD_PROBE),
    workers: typeof scope.Worker === 'function',
    cacheStorage: scope.caches !== undefined,
    sharedArrayBuffer: typeof scope.SharedArrayBuffer === 'function',
    crossOriginIsolated: scope.crossOriginIsolated === true,
    webCodecsVideoEncode: typeof scope.VideoEncoder === 'function',
    webCodecsAudioEncode: typeof scope.AudioEncoder === 'function',
    webGpuApi: nav.gpu !== undefined,
  };
}

export type MissingFeature = 'wasm' | 'wasm-simd' | 'workers' | 'cache-storage';

/** Features without which no tool can run (docs/ARCHITECTURE.md §9). Empty means supported. */
export function missingRequirements(caps: Capabilities): MissingFeature[] {
  const missing: MissingFeature[] = [];
  if (!caps.wasm) missing.push('wasm');
  else if (!caps.wasmSimd) missing.push('wasm-simd');
  if (!caps.workers) missing.push('workers');
  if (!caps.cacheStorage) missing.push('cache-storage');
  return missing;
}
