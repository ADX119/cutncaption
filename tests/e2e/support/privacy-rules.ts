/**
 * What the site may send over the network. This is the testable form of the promise
 * "your file is never uploaded" (docs/PRD.md G2).
 *
 * Measured on the live site (M1.15): a full visit that reads a video makes only
 * same-origin GETs, a GET of Cloudflare's analytics script, and analytics reports
 * of about 830 bytes. A video upload would be many kilobytes, so the body limit
 * catches it without false alarms.
 */
export const MAX_BODY_BYTES = 2048;

/** Other hosts the site may contact, and how. */
const THIRD_PARTY: ReadonlyArray<{ origin: string; methods: readonly string[]; path?: RegExp }> = [
  { origin: 'https://static.cloudflareinsights.com', methods: ['GET'] },
  { origin: 'https://cloudflareinsights.com', methods: ['POST'], path: /^\/cdn-cgi\/rum$/ },
];

export interface RequestInfo {
  readonly url: string;
  readonly method: string;
  /**
   * Size of the request body, or null when the browser does not reveal it. WebKit
   * hides bodies built from a Blob or File, which is exactly what an upload would be.
   */
  readonly bodyBytes: number | null;
}

/** Methods that do not carry a body. */
const BODILESS = new Set(['GET', 'HEAD', 'OPTIONS']);

/** Why a request breaks the rules, or null if it is allowed. */
export function privacyViolation(request: RequestInfo, siteOrigin: string): string | null {
  const { url, method, bodyBytes } = request;
  if (bodyBytes !== null && bodyBytes > MAX_BODY_BYTES) {
    return `${method} ${url} sends ${bodyBytes} bytes (limit ${MAX_BODY_BYTES})`;
  }

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return `unparseable URL ${url}`;
  }
  // Local data that never touches the network.
  if (parsed.protocol === 'blob:' || parsed.protocol === 'data:') return null;

  const allowedThirdParty = THIRD_PARTY.some(
    (rule) =>
      rule.origin === parsed.origin &&
      rule.methods.includes(method) &&
      (rule.path === undefined || rule.path.test(parsed.pathname)),
  );
  // A sending request whose body cannot be checked fails, except the analytics report.
  if (bodyBytes === null && !BODILESS.has(method) && !allowedThirdParty) {
    return `${method} ${url} sends a body the browser does not reveal`;
  }
  if (parsed.origin === siteOrigin || allowedThirdParty) return null;
  return `${method} ${url} goes to a host that is not allowed`;
}
