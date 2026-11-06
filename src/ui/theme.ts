// Theme choice (SPEC §2: follow the phone by default). Stored per device in localStorage; storage can be missing or
// blocked (private mode), so every access is guarded and the app still renders with the phone's theme.
export type ThemeChoice = 'system' | 'dark' | 'light';

const KEY = 'theme';

export function readTheme(): ThemeChoice {
  try {
    const v = localStorage.getItem(KEY);
    return v === 'dark' || v === 'light' ? v : 'system';
  } catch {
    return 'system';
  }
}

export function applyTheme(t: ThemeChoice): void {
  if (t === 'system') delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = t;
  try {
    if (t === 'system') localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, t);
  } catch {
    // Not stored: the choice still applies until the app is closed.
  }
}
