import { ASSET_PREFIX, type Bucket, handleAssetRequest } from './assets';

/**
 * The site's only server code. Static pages are served by Cloudflare directly; this
 * Worker runs only for the paths listed under assets.run_worker_first in wrangler.jsonc.
 */
interface Env {
  readonly ASSETS_BUCKET: Bucket;
}

const worker = {
  async fetch(request: Request, env: Env): Promise<Response> {
    const { pathname } = new URL(request.url);
    if (pathname.startsWith(ASSET_PREFIX)) return handleAssetRequest(request, env.ASSETS_BUCKET);
    return new Response('Not found', { status: 404 });
  },
};

export default worker;
