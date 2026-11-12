const BEACON_SRC = 'https://static.cloudflareinsights.com/beacon.min.js';
const TOKEN_PATTERN = /^[a-f0-9]{32}$/;

/** True for a well-formed Cloudflare Web Analytics site token. */
export function isBeaconToken(token: string | undefined): token is string {
  return token !== undefined && TOKEN_PATTERN.test(token);
}

/**
 * Cloudflare Web Analytics: cookieless page views and Web Vitals. Renders nothing
 * unless a valid token is configured, so local and test builds make no outside request.
 * `crossOrigin` keeps the script loadable on the cross-origin isolated tool routes.
 */
export function AnalyticsBeacon({ token }: { token: string | undefined }) {
  if (!isBeaconToken(token)) return null;
  return (
    <script
      defer
      src={BEACON_SRC}
      crossOrigin="anonymous"
      data-cf-beacon={JSON.stringify({ token })}
    />
  );
}
