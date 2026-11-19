import type { Metadata } from 'next';
import { TextPreview } from '@/features/meme-studio';
import { t } from '@/i18n';

// Design review and browser tests only: unlisted and kept out of search results.
export const metadata: Metadata = {
  title: t('textPreview.title'),
  robots: { index: false, follow: false },
};

export default function TextPreviewPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 pt-14 pb-16 sm:px-6">
      <h1 className="display text-4xl">{t('textPreview.title')}</h1>
      <div className="mt-8">
        <TextPreview />
      </div>
    </main>
  );
}
