import { t } from '@/i18n';

export default function HomePage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-16">
      <h1 className="text-3xl font-bold">{t('app.name')}</h1>
      <p className="mt-4">{t('app.tagline')}</p>
    </main>
  );
}
