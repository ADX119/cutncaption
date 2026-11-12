import { t } from '@/i18n';

export function SiteFooter() {
  return (
    <footer className="border-rule mt-24 border-t">
      <div className="text-graphite mx-auto max-w-5xl px-4 py-8 text-sm sm:px-6">
        <p className="max-w-[60ch]">{t('footer.privacy')}</p>
      </div>
    </footer>
  );
}
