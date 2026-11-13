import { EngineError, isAbortError } from '../errors';

/** Size and fingerprint of one large engine file (see scripts/assets.mjs). */
export interface AssetEntry {
  readonly bytes: number;
  readonly sha256: string;
}
export type AssetManifest = Readonly<Record<string, AssetEntry>>;

export interface AssetProgress {
  readonly loadedBytes: number;
  readonly totalBytes: number;
}

export interface FetchAssetOptions {
  readonly signal?: AbortSignal;
  readonly onProgress?: (progress: AssetProgress) => void;
}

/** Everything the loader touches from the outside world, so tests can supply fakes. */
export interface AssetLoaderDeps {
  readonly manifest: AssetManifest;
  /** URL prefix the keys are served under, e.g. "/assets". */
  readonly baseUrl: string;
  readonly fetch: typeof fetch;
  /** Undefined where Cache Storage does not exist (some private modes). */
  readonly caches: CacheStorage | undefined;
}

export interface AssetLoader {
  /** Returns the file, from the cache when possible, verified against the manifest. */
  fetchAsset(key: string, options?: FetchAssetOptions): Promise<Blob>;
  /** Whether the file can be had without a download. */
  isCached(key: string): Promise<boolean>;
  /** Deletes cached files that are no longer in the manifest. Returns how many. */
  pruneCache(): Promise<number>;
}

/** Bump the suffix only if the cache layout itself changes; file versions live in the keys. */
export const ASSET_CACHE_NAME = 'cnc-assets-v1';

async function sha256Hex(blob: Blob): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', await blob.arrayBuffer());
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export function createAssetLoader(deps: AssetLoaderDeps): AssetLoader {
  const urlFor = (key: string) => `${deps.baseUrl}/${key}`;

  function entryFor(key: string): AssetEntry {
    const entry = deps.manifest[key];
    if (!entry) throw new EngineError('asset-unknown', key);
    return entry;
  }

  /** The cache, or undefined when storage is missing or blocked. Never throws. */
  async function openCache(): Promise<Cache | undefined> {
    try {
      return await deps.caches?.open(ASSET_CACHE_NAME);
    } catch {
      return undefined;
    }
  }

  /** A cached copy of the right size, or undefined. A wrong-sized copy is discarded. */
  async function readCached(cache: Cache | undefined, key: string): Promise<Blob | undefined> {
    if (!cache) return undefined;
    try {
      const hit = await cache.match(urlFor(key));
      if (!hit) return undefined;
      const blob = await hit.blob();
      if (blob.size === entryFor(key).bytes) return blob;
      await cache.delete(urlFor(key));
    } catch {
      // A broken cache must never stop a tool from loading; fall through to the network.
    }
    return undefined;
  }

  async function download(key: string, options: FetchAssetOptions): Promise<Blob> {
    const entry = entryFor(key);
    const url = urlFor(key);

    let response: Response;
    try {
      response = await deps.fetch(url, { signal: options.signal });
    } catch (error) {
      if (isAbortError(error)) throw new EngineError('cancelled', key, { cause: error });
      throw new EngineError('asset-download-failed', `${url}: ${String(error)}`, { cause: error });
    }
    if (!response.ok) {
      throw new EngineError('asset-download-failed', `${url}: HTTP ${response.status}`);
    }

    const type = response.headers.get('Content-Type') ?? 'application/octet-stream';
    const chunks: BlobPart[] = [];
    let loadedBytes = 0;

    try {
      if (response.body) {
        const reader = response.body.getReader();
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          chunks.push(value);
          loadedBytes += value.byteLength;
          options.onProgress?.({ loadedBytes, totalBytes: entry.bytes });
        }
      } else {
        const buffer = await response.arrayBuffer();
        chunks.push(buffer);
        loadedBytes = buffer.byteLength;
      }
    } catch (error) {
      if (isAbortError(error) || options.signal?.aborted) {
        throw new EngineError('cancelled', key, { cause: error });
      }
      throw new EngineError('asset-download-failed', `${url}: ${String(error)}`, { cause: error });
    }

    const blob = new Blob(chunks, { type });
    if (blob.size !== entry.bytes) {
      throw new EngineError('asset-corrupt', `${key}: ${blob.size} bytes, expected ${entry.bytes}`);
    }
    if ((await sha256Hex(blob)) !== entry.sha256) {
      throw new EngineError('asset-corrupt', `${key}: checksum mismatch`);
    }
    return blob;
  }

  async function store(cache: Cache | undefined, key: string, blob: Blob): Promise<void> {
    if (!cache) return;
    try {
      await cache.put(
        urlFor(key),
        new Response(blob, {
          headers: { 'Content-Type': blob.type, 'Content-Length': String(blob.size) },
        }),
      );
    } catch {
      // Usually the storage quota. The file still works for this visit; it just
      // downloads again next time.
    }
  }

  return {
    async fetchAsset(key, options = {}) {
      const entry = entryFor(key);
      if (options.signal?.aborted) throw new EngineError('cancelled', key);

      const cache = await openCache();
      const cached = await readCached(cache, key);
      if (cached) {
        options.onProgress?.({ loadedBytes: entry.bytes, totalBytes: entry.bytes });
        return cached;
      }

      const blob = await download(key, options);
      await store(cache, key, blob);
      return blob;
    },

    async isCached(key) {
      entryFor(key);
      return (await readCached(await openCache(), key)) !== undefined;
    },

    async pruneCache() {
      const cache = await openCache();
      if (!cache) return 0;
      const current = new Set(Object.keys(deps.manifest).map(urlFor));
      let removed = 0;
      try {
        for (const request of await cache.keys()) {
          const { pathname } = new URL(request.url, 'http://local');
          if (!current.has(pathname) && !current.has(request.url)) {
            await cache.delete(request);
            removed += 1;
          }
        }
      } catch {
        // Pruning is housekeeping; a failure here is not worth surfacing.
      }
      return removed;
    },
  };
}
