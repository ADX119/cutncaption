import type { Metadata } from 'next';
import { JobStatesPreview } from '@/features/shell';
import { t } from '@/i18n';

// Design review and browser tests only: unlisted and kept out of search results.
export const metadata: Metadata = {
  title: t('preview.title'),
  robots: { index: false, follow: false },
};

export default function JobStatesPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 pt-14 sm:px-6">
      <h1 className="display text-4xl">{t('preview.title')}</h1>
      <div className="mt-8">
        <JobStatesPreview />
      </div>
    </main>
  );
}
