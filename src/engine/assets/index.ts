import { type AssetLoader, type AssetManifest, createAssetLoader } from './fetchAsset';
import manifest from './manifest.json';

export { ASSET_CACHE_NAME, createAssetLoader } from './fetchAsset';
export type {
  AssetEntry,
  AssetLoader,
  AssetLoaderDeps,
  AssetManifest,
  AssetProgress,
  FetchAssetOptions,
} from './fetchAsset';

export const ASSET_MANIFEST: AssetManifest = manifest;

let loader: AssetLoader | undefined;

/**
 * The app's asset loader, backed by the real network and Cache Storage. Created on
 * first use because this module is also evaluated during the static build, where
 * neither exists.
 */
export function assets(): AssetLoader {
  loader ??= createAssetLoader({
    manifest: ASSET_MANIFEST,
    baseUrl: process.env.NEXT_PUBLIC_ASSET_BASE_URL ?? '/assets',
    fetch: (input, init) => globalThis.fetch(input, init),
    caches: globalThis.caches,
  });
  return loader;
}
