import { useEffect, useState } from 'react';
import { parseRoute, type Route } from './app/route';
import { readSyncState, runSync, syncLabel, SYNC_EVENT } from './modules/sync/actions';
import type { SyncState } from './data/sync-engine';
import ExerciseDetail from './modules/library/ExerciseDetail';
import ExerciseList from './modules/library/ExerciseList';
import CreditsScreen from './modules/library/CreditsScreen';
import { libraryModule } from './modules/library/register';
import WorkoutScreen from './modules/training/WorkoutScreen';
import PlanScreen from './modules/training/PlanScreen';
import HistoryScreen from './modules/training/HistoryScreen';
import SettingsScreen from './modules/training/SettingsScreen';
import ProgressScreen from './modules/progress/ProgressScreen';
import Onboarding from './modules/onboarding/Onboarding';
import { getRepo } from './modules/training/data';

// Shell: top bar, screen, bottom nav. Hash routing only (CLAUDE.md): no server rewrites on GitHub Pages.
const TABS: ReadonlyArray<{ screen: Route['screen']; label: string }> = [
  { screen: 'today', label: 'Today' },
  { screen: 'plan', label: 'Plan' },
  { screen: 'library', label: libraryModule.label },
  { screen: 'history', label: 'History' },
  { screen: 'settings', label: 'Settings' },
];

// Which bottom tab is highlighted for a route (detail belongs to Library, credits to Settings, progress to Today).
function tabFor(route: Route): Route['screen'] {
  if (route.screen === 'exercise') return 'library';
  if (route.screen === 'credits') return 'settings';
  if (route.screen === 'progress' || route.screen === 'onboarding') return 'today';
  return route.screen;
}

function Screen({ route }: { route: Route }) {
  switch (route.screen) {
    case 'today':
      return <WorkoutScreen />;
    case 'plan':
      return <PlanScreen />;
    case 'library':
      return <ExerciseList />;
    case 'exercise':
      return <ExerciseDetail id={route.id} />;
    case 'history':
      return <HistoryScreen />;
    case 'settings':
      return <SettingsScreen />;
    case 'credits':
      return <CreditsScreen />;
    case 'progress':
      return <ProgressScreen />;
    case 'onboarding':
      return <Onboarding />;
  }
}

export default function App() {
  const [route, setRoute] = useState<Route>(() => parseRoute(window.location.hash));
  const [sync, setSync] = useState<SyncState | null>(null);

  useEffect(() => {
    const onHash = () => setRoute(parseRoute(window.location.hash));
    const refresh = () => readSyncState().then(setSync).catch(() => undefined);
    const onOnline = () => {
      void runSync().catch(() => undefined);
    };
    window.addEventListener('hashchange', onHash);
    window.addEventListener(SYNC_EVENT, refresh);
    window.addEventListener('online', onOnline);
    refresh();
    // First run: no finished onboarding means the interview comes first (SPEC §2).
    getRepo()
      .then((r) => r.getSettings())
      .then((s) => {
        if (!s?.onboardedAt && !window.location.hash.startsWith('#/onboarding')) window.location.hash = '#/onboarding';
      })
      .catch(() => undefined);
    // Pull on open: the app shows local data at once, and the server's changes arrive a moment later.
    void runSync().catch(() => undefined);
    return () => {
      window.removeEventListener('hashchange', onHash);
      window.removeEventListener(SYNC_EVENT, refresh);
      window.removeEventListener('online', onOnline);
    };
  }, []);

  const active = tabFor(route);

  return (
    <div className="app">
      <header className="topbar">
        <span className="title">onlyLeveling</span>
        <span className="synced">{sync ? syncLabel(sync) : ''}</span>
      </header>
      <main className="content">
        <Screen route={route} />
      </main>
      <nav className="bottom-nav" aria-label="Main">
        {TABS.map((t) => (
          <a key={t.screen} href={`#/${t.screen}`} aria-current={t.screen === active ? 'page' : undefined}>
            {t.label}
          </a>
        ))}
      </nav>
    </div>
  );
}
