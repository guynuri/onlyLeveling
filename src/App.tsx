import { useEffect, useState, type ReactNode } from 'react';
import { ClipboardList, House, Menu, Play, TrendingUp } from 'lucide-react';
import { parseRoute, tabFor, type Route, type Tab } from './app/route';
import MoreScreen from './app/MoreScreen';
import { ToastHost } from './ui/controls';
import ExerciseSheet from './modules/library/ExerciseSheet';
import { readSyncState, runSync, syncLabel, SYNC_EVENT } from './modules/sync/actions';
import type { SyncState } from './data/sync-engine';
import ExerciseDetail from './modules/library/ExerciseDetail';
import ExerciseList from './modules/library/ExerciseList';
import CreditsScreen from './modules/library/CreditsScreen';
import WorkoutScreen from './modules/training/WorkoutScreen';
import PlanScreen from './modules/training/PlanScreen';
import HistoryScreen from './modules/training/HistoryScreen';
import SettingsScreen from './modules/training/SettingsScreen';
import ProgressScreen from './modules/progress/ProgressScreen';
import Onboarding from './modules/onboarding/Onboarding';
import { getRepo } from './modules/training/data';

// Shell: top bar, screen, tab bar (UX design §6.1). Hash routing only (CLAUDE.md): no server rewrites on GitHub Pages.
const TABS: ReadonlyArray<{ tab: Tab; label: string; icon: ReactNode }> = [
  { tab: 'home', label: 'Home', icon: <House /> },
  { tab: 'plan', label: 'Plan', icon: <ClipboardList /> },
  { tab: 'workout', label: 'Train', icon: <Play /> },
  { tab: 'progress', label: 'Progress', icon: <TrendingUp /> },
  { tab: 'more', label: 'More', icon: <Menu /> },
];

function Screen({ route }: { route: Route }) {
  switch (route.screen) {
    // U6 replaces Home with the hub; until then Home and Train both show today's workout.
    case 'home':
    case 'workout':
      return <WorkoutScreen />;
    case 'more':
      return <MoreScreen />;
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
      <nav className="ui-tabbar" aria-label="Main">
        {TABS.map((t) => (
          <a
            key={t.tab}
            href={`#/${t.tab}`}
            className={t.tab === 'workout' ? 'ui-tab ui-tab--train' : 'ui-tab'}
            aria-current={t.tab === active ? 'page' : undefined}
          >
            <span className="ui-tab-icon">{t.icon}</span>
            <span className="ui-tab-label">{t.label}</span>
          </a>
        ))}
      </nav>
      <ExerciseSheet />
      <ToastHost />
    </div>
  );
}
