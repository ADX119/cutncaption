import type { Metadata } from 'next';
import { BrowserGate, EngineCheck } from '@/features/shell';
import { t } from '@/i18n';

// A diagnostics page, not one of the 20 tools: unlisted and kept out of search results.
// It sits under /tools/ so it is cross-origin isolated exactly like the real tools.
export const metadata: Metadata = {
  title: t('engineCheck.title'),
  robots: { index: false, follow: false },
};

export default function EngineCheckPage() {
  return (
    <main className="mx-auto max-w-5xl px-4 pt-14 sm:px-6">
      <h1 className="display text-4xl">{t('engineCheck.title')}</h1>
      <p className="text-graphite mt-4 max-w-[56ch]">{t('engineCheck.intro')}</p>
      <div className="mt-8">
        <BrowserGate>
          <EngineCheck />
        </BrowserGate>
      </div>
    </main>
  );
}
