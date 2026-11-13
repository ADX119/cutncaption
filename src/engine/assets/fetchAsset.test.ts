import { createHash } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { EngineError } from '../errors';
import {
  ASSET_CACHE_NAME,
  type AssetLoaderDeps,
  type AssetProgress,
  createAssetLoader,
} from './fetchAsset';

const KEY = 'ffmpeg/1.0/st/core.wasm';
const URL_PATH = `/assets/${KEY}`;
const DATA = new Uint8Array(1000).map((_, index) => index % 251);
const MANIFEST = {
  [KEY]: { bytes: DATA.length, sha256: createHash('sha256').update(DATA).digest('hex') },
};

/** Minimal in-memory Cache Storage. `failPut` simulates a full disk. */
function fakeCaches(options: { failPut?: boolean } = {}) {
  const store = new Map<string, Response>();
  const cache = {
    match: async (url: string) => store.get(url)?.clone(),
    put: async (url: string, response: Response) => {
      if (options.failPut) throw new DOMException('full', 'QuotaExceededError');
      store.set(url, response);
    },
    delete: async (request: string | { url: string }) =>
      store.delete(typeof request === 'string' ? request : request.url),
    keys: async () => [...store.keys()].map((url) => ({ url })),
  };
  const open = vi.fn(async () => cache);
  return { caches: { open } as unknown as CacheStorage, store, open };
}

/** A fetch that streams `body` in 100-byte chunks, honouring the abort signal. */
function fakeFetch(body: Uint8Array = DATA, status = 200) {
  return vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
    const signal = init?.signal;
    if (signal?.aborted) throw new DOMException('aborted', 'AbortError');
    let offset = 0;
    const stream = new ReadableStream<Uint8Array>({
      pull(controller) {
        if (signal?.aborted) {
          controller.error(new DOMException('aborted', 'AbortError'));
        } else if (offset >= body.length) {
          controller.close();
        } else {
          controller.enqueue(body.slice(offset, offset + 100));
          offset += 100;
        }
      },
    });
    return new Response(stream, { status, headers: { 'Content-Type': 'application/wasm' } });
  });
}

function setup(overrides: Partial<AssetLoaderDeps> = {}) {
  const { caches, store } = fakeCaches();
  const fetch = fakeFetch();
  const loader = createAssetLoader({
    manifest: MANIFEST,
    baseUrl: '/assets',
    fetch,
    caches,
    ...overrides,
  });
  return { loader, fetch, store };
}

async function bytesOf(blob: Blob) {
  return new Uint8Array(await blob.arrayBuffer());
}

async function codeOf(promise: Promise<unknown>) {
  const error = await promise.then(
    () => undefined,
    (reason: unknown) => reason,
  );
  expect(error).toBeInstanceOf(EngineError);
  return (error as EngineError).code;
}

describe('fetchAsset', () => {
  it('downloads on a miss, verifies, stores and reports progress', async () => {
    const { loader, fetch, store } = setup();
    const progress: AssetProgress[] = [];

    const blob = await loader.fetchAsset(KEY, { onProgress: (p) => progress.push(p) });

    expect(await bytesOf(blob)).toEqual(DATA);
    expect(blob.type).toBe('application/wasm');
    expect(fetch).toHaveBeenCalledOnce();
    expect(fetch.mock.calls[0]?.[0]).toBe(URL_PATH);
    expect(store.has(URL_PATH)).toBe(true);

    expect(progress.length).toBe(10);
    expect(progress.map((p) => p.loadedBytes)).toEqual(
      [...progress.map((p) => p.loadedBytes)].sort((a, b) => a - b),
    );
    expect(progress.at(-1)).toEqual({ loadedBytes: 1000, totalBytes: 1000 });
  });

  it('serves a hit from the cache without touching the network', async () => {
    const { loader, fetch } = setup();
    await loader.fetchAsset(KEY);
    const progress: AssetProgress[] = [];

    const blob = await loader.fetchAsset(KEY, { onProgress: (p) => progress.push(p) });

    expect(await bytesOf(blob)).toEqual(DATA);
    expect(fetch).toHaveBeenCalledOnce();
    expect(progress).toEqual([{ loadedBytes: 1000, totalBytes: 1000 }]);
    expect(await loader.isCached(KEY)).toBe(true);
  });

  it('rejects a download whose checksum is wrong and does not cache it', async () => {
    const tampered = DATA.slice();
    tampered[0] = 255;
    const { loader, store } = setup({ fetch: fakeFetch(tampered) });

    expect(await codeOf(loader.fetchAsset(KEY))).toBe('asset-corrupt');
    expect(store.size).toBe(0);
  });

  it('rejects a truncated download', async () => {
    const { loader, store } = setup({ fetch: fakeFetch(DATA.slice(0, 600)) });
    expect(await codeOf(loader.fetchAsset(KEY))).toBe('asset-corrupt');
    expect(store.size).toBe(0);
  });

  it('discards a cached copy of the wrong size and downloads again', async () => {
    const { loader, fetch, store } = setup();
    store.set(URL_PATH, new Response(DATA.slice(0, 10)));

    const blob = await loader.fetchAsset(KEY);

    expect(await bytesOf(blob)).toEqual(DATA);
    expect(fetch).toHaveBeenCalledOnce();
    expect((await store.get(URL_PATH)?.clone().blob())?.size).toBe(1000);
  });

  it('still returns the file when storage is full', async () => {
    const { loader } = setup({ caches: fakeCaches({ failPut: true }).caches });
    expect((await loader.fetchAsset(KEY)).size).toBe(1000);
    expect(await loader.isCached(KEY)).toBe(false);
  });

  it('works without Cache Storage, and when opening it is blocked', async () => {
    const none = setup({ caches: undefined });
    expect((await none.loader.fetchAsset(KEY)).size).toBe(1000);

    const blocked = {
      open: async () => {
        throw new DOMException('blocked', 'SecurityError');
      },
    } as unknown as CacheStorage;
    const { loader } = setup({ caches: blocked });
    expect((await loader.fetchAsset(KEY)).size).toBe(1000);
    expect(await loader.pruneCache()).toBe(0);
  });

  it('rejects as cancelled when aborted before starting', async () => {
    const { loader, fetch } = setup();
    const controller = new AbortController();
    controller.abort();
    expect(await codeOf(loader.fetchAsset(KEY, { signal: controller.signal }))).toBe('cancelled');
    expect(fetch).not.toHaveBeenCalled();
  });

  it('rejects as cancelled when aborted mid-download and caches nothing', async () => {
    const { loader, store } = setup();
    const controller = new AbortController();
    const pending = loader.fetchAsset(KEY, {
      signal: controller.signal,
      onProgress: ({ loadedBytes }) => {
        if (loadedBytes >= 300) controller.abort();
      },
    });
    expect(await codeOf(pending)).toBe('cancelled');
    expect(store.size).toBe(0);
  });

  it('reports an HTTP error with its status', async () => {
    const { loader } = setup({ fetch: fakeFetch(DATA, 404) });
    const error = await loader.fetchAsset(KEY).catch((reason: unknown) => reason);
    expect((error as EngineError).code).toBe('asset-download-failed');
    expect((error as EngineError).detail).toContain('HTTP 404');
  });

  it('reports a network failure', async () => {
    const offline = vi.fn(async () => {
      throw new TypeError('Failed to fetch');
    });
    const { loader } = setup({ fetch: offline });
    expect(await codeOf(loader.fetchAsset(KEY))).toBe('asset-download-failed');
  });

  it('refuses a key that is not in the manifest', async () => {
    const { loader, fetch } = setup();
    expect(await codeOf(loader.fetchAsset('models/unknown.onnx'))).toBe('asset-unknown');
    expect(fetch).not.toHaveBeenCalled();
  });
});

describe('pruneCache', () => {
  it('removes files from older versions and keeps the current ones', async () => {
    const { loader, store } = setup();
    await loader.fetchAsset(KEY);
    store.set('/assets/ffmpeg/0.9/st/core.wasm', new Response('old'));
    store.set('/assets/models/retired/model.onnx', new Response('old'));

    expect(await loader.pruneCache()).toBe(2);
    expect([...store.keys()]).toEqual([URL_PATH]);
  });

  it('uses one named cache', async () => {
    const { caches, open } = fakeCaches();
    const { loader } = setup({ caches });
    await loader.fetchAsset(KEY);
    expect(open).toHaveBeenCalledWith(ASSET_CACHE_NAME);
  });
});
