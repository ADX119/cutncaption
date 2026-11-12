import { type Capabilities, type MissingFeature, missingRequirements } from './capabilities';
import { type DeviceEnv, type InAppBrowser, detectInAppBrowser } from './platform';

export type BrowserSupport =
  | { readonly status: 'ok' }
  | { readonly status: 'in-app'; readonly app: InAppBrowser }
  | { readonly status: 'unsupported'; readonly missing: readonly MissingFeature[] };

/**
 * Whether tools can run here. In-app browsers are reported first because the fix
 * (open in a real browser) is something the person can do right away.
 */
export function assessBrowser(env: DeviceEnv, caps: Capabilities): BrowserSupport {
  const app = detectInAppBrowser(env);
  if (app) return { status: 'in-app', app };
  const missing = missingRequirements(caps);
  if (missing.length > 0) return { status: 'unsupported', missing };
  return { status: 'ok' };
}
