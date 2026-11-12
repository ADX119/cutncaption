'use client';

import { useState } from 'react';
import type { InAppBrowser } from '@/engine/device';
import { t } from '@/i18n';
import { Notice } from './Notice';

type CopyState = 'idle' | 'copied' | 'failed';

/** In-app webviews cannot save files reliably, so we send the person to a real browser. */
export function InAppNotice({ app, url }: { app: InAppBrowser; url: string }) {
  const [copy, setCopy] = useState<CopyState>('idle');

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(url);
      setCopy('copied');
    } catch {
      setCopy('failed');
    }
  }

  return (
    <Notice title={t('browser.inApp.title')}>
      <p className="text-graphite max-w-[56ch]">
        {t('browser.inApp.body', { app: t(`browser.app.${app}`) })}
      </p>
      <p className="border-rule bg-paper max-w-full rounded-md border px-3 py-2 text-sm break-all select-all">
        {url}
      </p>
      <button
        type="button"
        onClick={copyLink}
        className="pressable bg-accent text-on-accent hover:bg-accent-strong min-h-12 rounded-full px-6 font-medium"
      >
        {/* The key restarts the appear animation when the label changes. */}
        <span key={copy} className="appear inline-block">
          {copy === 'copied' ? t('browser.inApp.copied') : t('browser.inApp.copy')}
        </span>
      </button>
      {copy === 'failed' && (
        <p role="alert" className="appear text-danger">
          {t('browser.inApp.copyFailed')}
        </p>
      )}
    </Notice>
  );
}
