export type Theme = 'light' | 'dark';

export const THEME_STORAGE_KEY = 'cnc-theme';

/** The theme to switch to, given the stored choice (if any) and the system setting. */
export function nextTheme(stored: string | null, systemPrefersDark: boolean): Theme {
  const current: Theme =
    stored === 'light' || stored === 'dark' ? stored : systemPrefersDark ? 'dark' : 'light';
  return current === 'dark' ? 'light' : 'dark';
}

/**
 * Runs in <head> before first paint so a stored choice never flashes the wrong theme.
 * Kept as a string because it must execute before any bundle loads.
 */
export const THEME_INIT_SCRIPT = `try{var t=localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});if(t==='light'||t==='dark')document.documentElement.dataset.theme=t}catch(e){}`;
