/** The slice of `navigator` that device detection reads. Plain data so it is easy to test. */
export interface DeviceEnv {
  readonly userAgent: string;
  readonly maxTouchPoints: number;
  /** Chromium only; quantised to 0.25–8 GB. */
  readonly deviceMemory?: number;
  readonly hardwareConcurrency?: number;
}

export function readDeviceEnv(nav: Navigator = navigator): DeviceEnv {
  return {
    userAgent: nav.userAgent,
    maxTouchPoints: nav.maxTouchPoints ?? 0,
    deviceMemory: (nav as Navigator & { deviceMemory?: number }).deviceMemory,
    hardwareConcurrency: nav.hardwareConcurrency,
  };
}

// UA sniffing is allowed here only: iOS and in-app browsers cannot be feature-detected.

export function isIos(env: DeviceEnv): boolean {
  if (/iPad|iPhone|iPod/.test(env.userAgent)) return true;
  // iPadOS reports a desktop Mac user agent; a touch screen gives it away.
  return /Macintosh/.test(env.userAgent) && env.maxTouchPoints > 1;
}

export function isAndroid(env: DeviceEnv): boolean {
  return /Android/.test(env.userAgent);
}

export function isMobile(env: DeviceEnv): boolean {
  return isIos(env) || isAndroid(env) || /Mobile/.test(env.userAgent);
}

export type InAppBrowser = 'instagram' | 'facebook' | 'tiktok' | 'line';

const IN_APP_PATTERNS: ReadonlyArray<readonly [InAppBrowser, RegExp]> = [
  ['instagram', /Instagram/],
  ['facebook', /FBAN|FBAV|FB_IAB/],
  ['tiktok', /musical_ly|BytedanceWebview|TikTok/],
  ['line', /\bLine\//],
];

/** In-app webviews handle blob downloads unreliably, so tools are blocked there. */
export function detectInAppBrowser(env: DeviceEnv): InAppBrowser | null {
  for (const [name, pattern] of IN_APP_PATTERNS) {
    if (pattern.test(env.userAgent)) return name;
  }
  return null;
}
