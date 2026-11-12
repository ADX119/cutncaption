import { describe, expect, it } from 'vitest';
import { type Bucket, type BucketObjectMeta, assetKey, handleAssetRequest } from './assets';

const BYTES = new TextEncoder().encode('0123456789');

/** In-memory stand-in for an R2 bucket, including its Range handling. */
function bucketWith(objects: Record<string, { contentType?: string }>): Bucket {
  const meta = (key: string): BucketObjectMeta | null =>
    key in objects
      ? {
          size: BYTES.length,
          httpEtag: `"etag-${key}"`,
          httpMetadata: { contentType: objects[key]?.contentType },
        }
      : null;

  return {
    head: async (key) => meta(key),
    get: async (key, options) => {
      const base = meta(key);
      if (!base) return null;
      const match = /^bytes=(\d+)-(\d*)$/.exec(options?.range?.get('Range') ?? '');
      if (!match) return { ...base, body: new Blob([BYTES]).stream() };
      const offset = Number(match[1]);
      const end = match[2] ? Number(match[2]) : BYTES.length - 1;
      const length = end - offset + 1;
      return {
        ...base,
        range: { offset, length },
        body: new Blob([BYTES.slice(offset, offset + length)]).stream(),
      };
    },
  };
}

const bucket = bucketWith({
  'ffmpeg/0.12.10/st/ffmpeg-core.wasm': {},
  'models/config.json': { contentType: 'application/json; charset=utf-8' },
});
const WASM_URL = 'https://site.test/assets/ffmpeg/0.12.10/st/ffmpeg-core.wasm';

const call = (url: string, init?: RequestInit) =>
  handleAssetRequest(new Request(url, init), bucket);

describe('assetKey', () => {
  it('maps the path to an object key', () => {
    expect(assetKey('/assets/ffmpeg/0.12.10/st/ffmpeg-core.wasm')).toBe(
      'ffmpeg/0.12.10/st/ffmpeg-core.wasm',
    );
    expect(assetKey('/assets/models/a%20b.onnx')).toBe('models/a b.onnx');
  });

  it.each([
    '/assets/',
    '/assets/folder/',
    '/assets/../secret',
    '/assets/a/%2e%2e/b',
    '/assets/a//b',
    '/assets/%E0%A4%A',
    '/other/file',
  ])('refuses %s', (path) => {
    expect(assetKey(path)).toBeNull();
  });
});

describe('handleAssetRequest', () => {
  it('streams an object with immutable caching and isolation headers', async () => {
    const response = await call(WASM_URL);
    expect(response.status).toBe(200);
    expect(await response.text()).toBe('0123456789');
    expect(response.headers.get('Content-Type')).toBe('application/wasm');
    expect(response.headers.get('Content-Length')).toBe('10');
    expect(response.headers.get('ETag')).toBe('"etag-ffmpeg/0.12.10/st/ffmpeg-core.wasm"');
    expect(response.headers.get('Cache-Control')).toBe('public, max-age=31536000, immutable');
    expect(response.headers.get('Cross-Origin-Resource-Policy')).toBe('same-origin');
    expect(response.headers.get('Cross-Origin-Embedder-Policy')).toBe('require-corp');
    expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
  });

  it('prefers the content type stored with the object', async () => {
    const response = await call('https://site.test/assets/models/config.json');
    expect(response.headers.get('Content-Type')).toBe('application/json; charset=utf-8');
  });

  it('answers HEAD with headers and no body', async () => {
    const response = await call(WASM_URL, { method: 'HEAD' });
    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Length')).toBe('10');
    expect(await response.text()).toBe('');
  });

  it('serves a byte range as 206', async () => {
    const response = await call(WASM_URL, { headers: { Range: 'bytes=2-5' } });
    expect(response.status).toBe(206);
    expect(response.headers.get('Content-Range')).toBe('bytes 2-5/10');
    expect(response.headers.get('Content-Length')).toBe('4');
    expect(await response.text()).toBe('2345');
  });

  it('serves an open-ended range to the end of the file', async () => {
    const response = await call(WASM_URL, { headers: { Range: 'bytes=7-' } });
    expect(response.headers.get('Content-Range')).toBe('bytes 7-9/10');
    expect(await response.text()).toBe('789');
  });

  it('returns 404 for a missing object and for an invalid path', async () => {
    expect((await call('https://site.test/assets/nope.wasm')).status).toBe(404);
    expect((await call('https://site.test/assets/../x')).status).toBe(404);
    expect((await call('https://site.test/assets/nope.wasm', { method: 'HEAD' })).status).toBe(404);
  });

  it.each(['POST', 'PUT', 'DELETE', 'PATCH'])('refuses %s', async (method) => {
    const response = await call(WASM_URL, { method });
    expect(response.status).toBe(405);
    expect(response.headers.get('Allow')).toBe('GET, HEAD');
  });
});
