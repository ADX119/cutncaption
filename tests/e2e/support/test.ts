import { type Request, test as base, expect } from '@playwright/test';
import { privacyViolation } from './privacy-rules';

/** Body size, 0 for requests without one, null when the browser hides it. */
function bodyBytesOf(request: Request): number | null {
  const body = request.postDataBuffer();
  if (body) return body.length;
  return ['GET', 'HEAD', 'OPTIONS'].includes(request.method()) ? 0 : null;
}

/**
 * The test function every e2e spec uses. It adds an automatic privacy guard: any
 * request to a host that is not allowed, or with a body over 2 KB, fails the test
 * (see privacy-rules.ts). Import `test` and `expect` from here, not from Playwright.
 */
export const test = base.extend<{ privacyGuard: string[] }>({
  privacyGuard: [
    async ({ context, baseURL }, use) => {
      const siteOrigin = new URL(baseURL ?? 'http://localhost').origin;
      const violations: string[] = [];
      // Context-wide, so requests from every page and worker are seen.
      context.on('request', (request) => {
        const violation = privacyViolation(
          {
            url: request.url(),
            method: request.method(),
            bodyBytes: bodyBytesOf(request),
          },
          siteOrigin,
        );
        if (violation) violations.push(violation);
      });
      await use(violations);
      expect(violations, 'requests that break the privacy rules').toEqual([]);
    },
    { auto: true },
  ],
});

export { expect };
export type { Page } from '@playwright/test';
