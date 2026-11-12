import { t } from '@/i18n';
import { ThemeToggle } from './ThemeToggle';

export interface NavLink {
  readonly href: string;
  readonly label: string;
}

/** The trim-selection mark: two handles and the span between them. Also used on the timeline. */
function SelectionMark() {
  return (
    <svg viewBox="0 0 28 20" className="text-accent h-5 w-7" fill="currentColor" aria-hidden="true">
      <rect x="1" y="1" width="4" height="18" rx="2" />
      <rect x="23" y="1" width="4" height="18" rx="2" />
      <rect x="8" y="8.75" width="12" height="2.5" rx="1.25" />
    </svg>
  );
}

/*
 * Every link here is a plain <a>, not next/link: tool routes are cross-origin isolated and
 * the rest of the site is not, so moving between them needs a full document load
 * (docs/ARCHITECTURE.md §4).
 */
export function SiteHeader({ nav }: { nav: readonly NavLink[] }) {
  return (
    <header className="border-rule border-b">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-6 px-4 sm:px-6">
        <a href="/" className="flex min-h-14 items-center gap-2.5" aria-label={t('nav.home')}>
          <SelectionMark />
          <span className="display text-xl">{t('app.name')}</span>
        </a>
        <div className="order-2 ml-auto sm:order-3 sm:ml-0">
          <ThemeToggle />
        </div>
        <nav
          aria-label={t('nav.tools')}
          className="order-3 -mx-1 flex w-full gap-1 pb-2 sm:order-2 sm:mx-0 sm:ml-auto sm:w-auto sm:pb-0"
        >
          {nav.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="pressable text-graphite hover:bg-accent-wash hover:text-ink flex min-h-11 items-center rounded-full px-3 text-[0.9375rem]"
            >
              {item.label}
            </a>
          ))}
        </nav>
      </div>
    </header>
  );
}
