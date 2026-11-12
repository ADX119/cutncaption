import { describe, expect, it } from 'vitest';
import { TOOL_PAGES, getToolPage, toolPath } from '@/seo/registry';

describe('tool page registry', () => {
  it('has exactly 20 pages', () => {
    expect(TOOL_PAGES).toHaveLength(20);
  });

  it('has unique, URL-safe slugs', () => {
    const slugs = TOOL_PAGES.map((page) => page.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const slug of slugs) expect(slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
  });

  it('gives pages that share a tool different presets', () => {
    const seen = new Set<string>();
    for (const page of TOOL_PAGES) {
      const key = `${page.tool}:${JSON.stringify(page.preset)}`;
      expect(seen.has(key), `duplicate tool+preset for ${page.slug}`).toBe(false);
      seen.add(key);
    }
  });

  it('looks pages up by slug', () => {
    expect(getToolPage('trim-video')?.tool).toBe('trim');
    expect(getToolPage('nope')).toBeUndefined();
  });

  it('builds trailing-slash paths', () => {
    expect(toolPath('trim-video')).toBe('/tools/trim-video/');
  });
});
