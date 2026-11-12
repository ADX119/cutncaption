'use client';

import { t } from '@/i18n';
import { THEME_STORAGE_KEY, nextTheme } from '@/lib';

/**
 * Switches between light and dark. Both icons are always rendered and CSS picks one
 * from the active theme, so server and client markup match whatever the theme is.
 */
export function ThemeToggle() {
  function toggle() {
    let stored: string | null = null;
    try {
      stored = localStorage.getItem(THEME_STORAGE_KEY);
    } catch {
      // Storage can be blocked; the choice then lasts for this page only.
    }
    const theme = nextTheme(stored, matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {
      // See above.
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={t('theme.toggle')}
      title={t('theme.toggle')}
      className="pressable text-graphite hover:bg-accent-wash hover:text-ink relative size-11 shrink-0 rounded-full"
    >
      <svg
        className="theme-icon theme-icon-sun size-5"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="4" />
        <path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6 7 7M17 17l1.4 1.4M5.6 18.4 7 17M17 7l1.4-1.4" />
      </svg>
      <svg
        className="theme-icon theme-icon-moon size-5"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z" />
      </svg>
    </button>
  );
}
