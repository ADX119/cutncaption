import { EngineError, isEngineError } from '../errors';

export type FontId = 'anton' | 'noto-sans' | 'noto-sans-devanagari';

export interface FontSpec {
  readonly id: FontId;
  /**
   * The family name inside the font file. The page registers the face under the same
   * name, so the canvas preview and libass (which reads the name from the file) pick
   * the same font.
   */
  readonly family: string;
  /** The face's only weight. Draw with exactly this weight or the browser fakes one. */
  readonly weight: number;
  /** Under /fonts/, named with the start of its SHA-256 so it can be cached as immutable. */
  readonly file: string;
  readonly bytes: number;
  /** The licence file shipped next to it. */
  readonly licence: string;
}

/**
 * The fonts the studio draws with, all SIL Open Font License 1.1. TrueType rather than
 * WOFF2, because ffmpeg's FreeType has no Brotli and cannot read WOFF2; caption burn-in
 * (M4.20) hands these same files to libass.
 */
export const FONTS: Readonly<Record<FontId, FontSpec>> = {
  // A condensed heavy face for classic top/bottom meme text.
  anton: {
    id: 'anton',
    family: 'Anton',
    weight: 400,
    file: 'Anton-Regular.a4ba3a92.ttf',
    bytes: 170_812,
    licence: 'OFL-Anton.txt',
  },
  // Latin, Greek and Cyrillic for caption bars and captions.
  'noto-sans': {
    id: 'noto-sans',
    family: 'Noto Sans',
    weight: 700,
    file: 'NotoSans-Bold.87cb2d84.ttf',
    bytes: 432_376,
    licence: 'OFL-Noto.txt',
  },
  // Hindi, with the conjuncts shaped by the browser (canvas) or HarfBuzz (libass).
  'noto-sans-devanagari': {
    id: 'noto-sans-devanagari',
    family: 'Noto Sans Devanagari',
    weight: 700,
    file: 'NotoSansDevanagari-Bold.ff2f76a2.ttf',
    bytes: 183_412,
    licence: 'OFL-Noto.txt',
  },
};

export const FONT_IDS = Object.keys(FONTS) as readonly FontId[];

export interface LoadedFont {
  readonly spec: FontSpec;
  /**
   * A fresh copy of the font file on every call. ffmpeg's writeFile transfers the
   * buffer it is given, which would empty a shared one.
   */
  bytes(): Uint8Array;
}

export interface FontLoaderDeps {
  readonly baseUrl: string;
  readonly fetch: (url: string) => Promise<Response>;
  /** Makes the face available to the page and its canvases. Rejects on unreadable data. */
  readonly register: (spec: FontSpec, data: Uint8Array) => Promise<void>;
}

export interface FontLoader {
  load(id: FontId): Promise<LoadedFont>;
  loadAll(ids?: readonly FontId[]): Promise<LoadedFont[]>;
}

export function createFontLoader(deps: FontLoaderDeps): FontLoader {
  const loads = new Map<FontId, Promise<LoadedFont>>();

  async function fetchFont(spec: FontSpec): Promise<Uint8Array> {
    let response: Response;
    try {
      response = await deps.fetch(`${deps.baseUrl}/${spec.file}`);
    } catch (error) {
      throw new EngineError('asset-download-failed', `${spec.file}: ${String(error)}`, {
        cause: error,
      });
    }
    if (!response.ok) {
      throw new EngineError('asset-download-failed', `${spec.file}: HTTP ${response.status}`);
    }
    const data = new Uint8Array(await response.arrayBuffer());
    if (data.byteLength !== spec.bytes) {
      throw new EngineError(
        'asset-corrupt',
        `${spec.file}: ${data.byteLength} bytes, expected ${spec.bytes}`,
      );
    }
    return data;
  }

  async function loadFont(spec: FontSpec): Promise<LoadedFont> {
    const data = await fetchFont(spec);
    try {
      await deps.register(spec, data);
    } catch (error) {
      if (isEngineError(error)) throw error;
      throw new EngineError('asset-corrupt', `${spec.file}: ${String(error)}`, { cause: error });
    }
    return { spec, bytes: () => data.slice() };
  }

  function load(id: FontId): Promise<LoadedFont> {
    const existing = loads.get(id);
    if (existing) return existing;
    const promise = loadFont(FONTS[id]);
    loads.set(id, promise);
    // Forget a failed load so that trying again fetches again.
    promise.catch(() => {
      if (loads.get(id) === promise) loads.delete(id);
    });
    return promise;
  }

  return {
    load,
    loadAll: (ids = FONT_IDS) => Promise.all(ids.map(load)),
  };
}
