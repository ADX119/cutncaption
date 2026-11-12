import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { AnalyticsBeacon, isBeaconToken } from './AnalyticsBeacon';

const TOKEN = '0123456789abcdef0123456789abcdef';

describe('AnalyticsBeacon', () => {
  it('renders nothing without a token', () => {
    expect(renderToStaticMarkup(<AnalyticsBeacon token={undefined} />)).toBe('');
    expect(renderToStaticMarkup(<AnalyticsBeacon token="" />)).toBe('');
  });

  it('refuses a malformed token rather than putting it in the page', () => {
    expect(isBeaconToken('abc')).toBe(false);
    expect(isBeaconToken(`${TOKEN}"><script>`)).toBe(false);
    expect(renderToStaticMarkup(<AnalyticsBeacon token={'"><script>alert(1)</script>'} />)).toBe(
      '',
    );
  });

  it('loads the Cloudflare beacon in a way that works on isolated pages', () => {
    const html = renderToStaticMarkup(<AnalyticsBeacon token={TOKEN} />);
    expect(html).toContain('src="https://static.cloudflareinsights.com/beacon.min.js"');
    expect(html).toContain('crossorigin="anonymous"');
    expect(html).toContain('defer');
    expect(html).toContain(`data-cf-beacon="{&quot;token&quot;:&quot;${TOKEN}&quot;}"`);
  });
});
