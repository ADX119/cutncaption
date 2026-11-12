'use client';

import { type ReactNode, useSyncExternalStore } from 'react';
import {
  type BrowserSupport,
  assessBrowser,
  detectCapabilities,
  readDeviceEnv,
} from '@/engine/device';
import { InAppNotice } from './InAppNotice';
import { UnsupportedNotice } from './UnsupportedNotice';

// The browser does not change during a visit, so assess once and keep a stable snapshot.
let cached: BrowserSupport | undefined;
const getSnapshot = () => (cached ??= assessBrowser(readDeviceEnv(), detectCapabilities()));
const getServerSnapshot = () => null;
const subscribe = () => () => {};

/**
 * Shows a tool only where it can run. The server render has no browser to inspect,
 * so it renders the tool and the check happens right after hydration.
 */
export function BrowserGate({ children }: { children: ReactNode }) {
  const support = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  if (support?.status === 'in-app') {
    return <InAppNotice app={support.app} url={window.location.href} />;
  }
  if (support?.status === 'unsupported') {
    return <UnsupportedNotice missing={support.missing} />;
  }
  return children;
}
