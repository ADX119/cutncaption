import type { MissingFeature } from '@/engine/device';
import { t } from '@/i18n';
import { Notice } from './Notice';

/** The browser lacks something every tool needs. Says what, and what to do. */
export function UnsupportedNotice({ missing }: { missing: readonly MissingFeature[] }) {
  const features = missing.map((feature) => t(`browser.feature.${feature}`)).join(', ');
  return (
    <Notice title={t('browser.unsupported.title')}>
      <p className="text-graphite max-w-[56ch]">{t('browser.unsupported.body', { features })}</p>
    </Notice>
  );
}
