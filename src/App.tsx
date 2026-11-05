import { useEffect, useState } from 'react';

// Phase 1 shell: bottom nav with placeholder tabs and a "last synced" indicator.
// Hash routing only (CLAUDE.md): no server rewrites on GitHub Pages.
const TABS = [
  { hash: 'today', label: 'Today' },
  { hash: 'history', label: 'History' },
  { hash: 'progress', label: 'Progress' },
  { hash: 'settings', label: 'Settings' },
] as const;

function currentTab(): string {
  const h = window.location.hash.replace(/^#\/?/, '');
  return TABS.some((t) => t.hash === h) ? h : 'today';
}

export default function App() {
  const [tab, setTab] = useState(currentTab);

  useEffect(() => {
    const onHash = () => setTab(currentTab());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const active = TABS.find((t) => t.hash === tab) ?? TABS[0];

  return (
    <div className="app">
      <header className="topbar">
        <span className="title">onlyLeveling</span>
        <span className="synced">last synced: never</span>
      </header>
      <main className="content">
        <h1>{active.label}</h1>
        <p className="muted">Coming in a later phase.</p>
      </main>
      <nav className="bottom-nav" aria-label="Main">
        {TABS.map((t) => (
          <a key={t.hash} href={`#/${t.hash}`} aria-current={t.hash === tab ? 'page' : undefined}>
            {t.label}
          </a>
        ))}
      </nav>
    </div>
  );
}
