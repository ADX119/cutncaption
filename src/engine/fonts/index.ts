import { type FontLoader, type FontSpec, createFontLoader } from './fonts';

export { FONTS, FONT_IDS, createFontLoader } from './fonts';
export type { FontId, FontLoader, FontLoaderDeps, FontSpec, LoadedFont } from './fonts';

/** Adds the face to document.fonts once it has parsed, so canvases can draw with it. */
async function registerWithDocument(spec: FontSpec, data: Uint8Array): Promise<void> {
  // FontFace keeps the buffer it is given; pass a copy so the loader's stays intact.
  const face = new FontFace(spec.family, data.slice().buffer, {
    weight: String(spec.weight),
    style: 'normal',
  });
  await face.load();
  document.fonts.add(face);
}

let loader: FontLoader | undefined;

/**
 * The app's font loader. Fonts are same-origin static files (`public/fonts`), loaded
 * only when a tool that draws text needs them. Created on first use because this module
 * is also evaluated during the static build, where there is no document.
 */
export function fonts(): FontLoader {
  loader ??= createFontLoader({
    baseUrl: '/fonts',
    fetch: (url) => globalThis.fetch(url),
    register: registerWithDocument,
  });
  return loader;
}
