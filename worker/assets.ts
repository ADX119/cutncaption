/**
 * Serves large binaries (ffmpeg wasm, ONNX runtime, models) from a private R2 bucket
 * at /assets/<key>, on the site's own origin. Static-asset hosting caps files at 25 MiB,
 * which these exceed. Read-only: GET and HEAD.
 *
 * The bucket types below are the small part of the R2 API this file uses, declared
 * structurally so the code typechecks and unit-tests without the Workers runtime types.
 */

export interface BucketRange {
  readonly offset: number;
  readonly length: number;
}

export interface BucketObjectMeta {
  readonly size: number;
  readonly httpEtag: string;
  readonly httpMetadata?: { readonly contentType?: string };
  /** Present when a byte range was requested and applied. */
  readonly range?: Partial<BucketRange>;
}

export interface BucketObject extends BucketObjectMeta {
  readonly body: ReadableStream;
}

export interface Bucket {
  head(key: string): Promise<BucketObjectMeta | null>;
  get(key: string, options?: { range?: Headers }): Promise<BucketObject | null>;
}

export const ASSET_PREFIX = '/assets/';

const CONTENT_TYPES: Readonly<Record<string, string>> = {
  wasm: 'application/wasm',
  js: 'text/javascript',
  mjs: 'text/javascript',
  json: 'application/json',
  txt: 'text/plain; charset=utf-8',
  onnx: 'application/octet-stream',
  bin: 'application/octet-stream',
};

function contentType(key: string, stored: string | undefined): string {
  if (stored) return stored;
  const extension = key.slice(key.lastIndexOf('.') + 1).toLowerCase();
  return CONTENT_TYPES[extension] ?? 'application/octet-stream';
}

/** Object key for a request path, or null if the path is not a valid asset path. */
export function assetKey(pathname: string): string | null {
  if (!pathname.startsWith(ASSET_PREFIX)) return null;
  let key: string;
  try {
    key = decodeURIComponent(pathname.slice(ASSET_PREFIX.length));
  } catch {
    return null;
  }
  if (key === '' || key.endsWith('/')) return null;
  if (key.split('/').some((segment) => segment === '' || segment === '.' || segment === '..')) {
    return null;
  }
  return key;
}

function plain(status: number, message: string, headers: Record<string, string> = {}): Response {
  return new Response(message, {
    status,
    headers: { 'Content-Type': 'text/plain; charset=utf-8', ...headers },
  });
}

/**
 * Headers for every asset response. public/_headers does not apply to responses a
 * Worker generates, so isolation and caching headers are set here. Keys contain a
 * version, so objects never change and can be cached for good.
 */
function assetHeaders(key: string, object: BucketObjectMeta): Headers {
  return new Headers({
    'Content-Type': contentType(key, object.httpMetadata?.contentType),
    ETag: object.httpEtag,
    'Cache-Control': 'public, max-age=31536000, immutable',
    'Accept-Ranges': 'bytes',
    'Cross-Origin-Resource-Policy': 'same-origin',
    'Cross-Origin-Embedder-Policy': 'require-corp',
    'X-Content-Type-Options': 'nosniff',
  });
}

export async function handleAssetRequest(request: Request, bucket: Bucket): Promise<Response> {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return plain(405, 'Method not allowed', { Allow: 'GET, HEAD' });
  }

  const key = assetKey(new URL(request.url).pathname);
  if (key === null) return plain(404, 'Not found');

  if (request.method === 'HEAD') {
    const meta = await bucket.head(key);
    if (!meta) return plain(404, 'Not found');
    const headers = assetHeaders(key, meta);
    headers.set('Content-Length', String(meta.size));
    return new Response(null, { status: 200, headers });
  }

  const wantsRange = request.headers.has('Range');
  const object = await bucket.get(key, wantsRange ? { range: request.headers } : undefined);
  if (!object) return plain(404, 'Not found');

  const headers = assetHeaders(key, object);
  const offset = object.range?.offset;
  const length = object.range?.length;

  if (wantsRange && offset !== undefined && length !== undefined) {
    headers.set('Content-Length', String(length));
    headers.set('Content-Range', `bytes ${offset}-${offset + length - 1}/${object.size}`);
    return new Response(object.body, { status: 206, headers });
  }

  headers.set('Content-Length', String(object.size));
  return new Response(object.body, { status: 200, headers });
}
