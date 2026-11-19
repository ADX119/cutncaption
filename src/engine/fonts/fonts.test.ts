import { describe, expect, it, vi } from 'vitest';
import { EngineError } from '../errors';
import { FONTS, FONT_IDS, type FontLoaderDeps, type FontSpec, createFontLoader } from './fonts';

/** A fetch serving bytes of the right size for every registered font. */
function fakeFetch(override: { status?: number; bytes?: number; fail?: boolean } = {}) {
  return vi.fn(async (url: string) => {
    if (override.fail) throw new TypeError('Failed to fetch');
    const spec = Object.values(FONTS).find((font) => url.endsWith(`/${font.file}`));
    if (!spec) return new Response(null, { status: 404 });
    const data = new Uint8Array(override.bytes ?? spec.bytes).fill(7);
    return new Response(data, { status: override.status ?? 200 });
  });
}

function setup(override?: Parameters<typeof fakeFetch>[0]) {
  const fetch = fakeFetch(override);
  const register = vi.fn<(spec: FontSpec, data: Uint8Array) => Promise<void>>(async () => {});
  const deps: FontLoaderDeps = { baseUrl: '/fonts', fetch, register };
  return { loader: createFontLoader(deps), fetch, register };
}

describe('createFontLoader', () => {
  it('fetches each font from the base URL and registers it under its family', async () => {
    const { loader, fetch, register } = setup();
    const font = await loader.load('anton');

    expect(fetch).toHaveBeenCalledWith(`/fonts/${FONTS.anton.file}`);
    expect(register).toHaveBeenCalledTimes(1);
    expect(register.mock.calls[0]?.[0]).toBe(FONTS.anton);
    expect(font.spec.family).toBe('Anton');
    expect(font.bytes()).toHaveLength(FONTS.anton.bytes);
  });

  it('resolves once per font, even when asked for it concurrently', async () => {
    const { loader, fetch, register } = setup();
    const [first, second] = await Promise.all([loader.load('noto-sans'), loader.load('noto-sans')]);
    const third = await loader.load('noto-sans');

    expect(first).toBe(second);
    expect(third).toBe(first);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(register).toHaveBeenCalledTimes(1);
  });

  it('loads every font with loadAll', async () => {
    const { loader, fetch } = setup();
    const fonts = await loader.loadAll();
    expect(fonts.map((font) => font.spec.id)).toEqual(FONT_IDS);
    expect(fetch).toHaveBeenCalledTimes(FONT_IDS.length);
  });

  it('hands out a fresh copy of the bytes each time, because ffmpeg takes ownership of them', async () => {
    const { loader } = setup();
    const font = await loader.load('noto-sans-devanagari');
    const a = font.bytes();
    const b = font.bytes();

    expect(a).not.toBe(b);
    expect(a.buffer).not.toBe(b.buffer);
    a.fill(0);
    expect(b[0]).toBe(7);
    expect(font.bytes()[0]).toBe(7);
  });

  it('reports a failed download as asset-download-failed and fetches again on retry', async () => {
    const { loader, fetch } = setup({ fail: true });
    const error = await loader.load('anton').catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(EngineError);
    expect((error as EngineError).code).toBe('asset-download-failed');
    expect((error as EngineError).detail).toContain(FONTS.anton.file);

    fetch.mockImplementation(fakeFetch());
    await expect(loader.load('anton')).resolves.toMatchObject({ spec: FONTS.anton });
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('reports an HTTP error as asset-download-failed', async () => {
    const { loader, register } = setup({ status: 404 });
    await expect(loader.load('noto-sans')).rejects.toMatchObject({
      code: 'asset-download-failed',
      detail: expect.stringContaining('404'),
    });
    expect(register).not.toHaveBeenCalled();
  });

  it('reports a truncated file as asset-corrupt and does not register it', async () => {
    const { loader, register } = setup({ bytes: 100 });
    await expect(loader.load('anton')).rejects.toMatchObject({ code: 'asset-corrupt' });
    expect(register).not.toHaveBeenCalled();
  });

  it('forgets a font that failed to register, so it can be tried again', async () => {
    const { loader, register } = setup();
    register.mockRejectedValueOnce(new Error('bad font data'));
    await expect(loader.load('anton')).rejects.toMatchObject({ code: 'asset-corrupt' });
    await expect(loader.load('anton')).resolves.toMatchObject({ spec: FONTS.anton });
    expect(register).toHaveBeenCalledTimes(2);
  });
});
