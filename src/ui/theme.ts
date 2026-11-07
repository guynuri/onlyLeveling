// Theme choice. Dark by default (owner decision 2026-11-07); 'system' follows the phone. Stored per device in localStorage; storage can be missing or
// blocked (private mode), so every access is guarded and the app still renders with the phone's theme.
export type ThemeChoice = 'system' | 'dark' | 'light';

const KEY = 'theme';

export function readTheme(): ThemeChoice {
  try {
    const v = localStorage.getItem(KEY);
    return v === 'system' || v === 'light' ? v : 'dark';
  } catch {
    return 'dark';
  }
}

export function applyTheme(t: ThemeChoice): void {
  if (t === 'system') delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = t;
  try {
    localStorage.setItem(KEY, t);
  } catch {
    // Not stored: the choice still applies until the app is closed.
  }
}
