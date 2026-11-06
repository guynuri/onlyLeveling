import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { ClipboardList, House, Menu, Play, TrendingUp } from 'lucide-react';
import { allowedWhileOnboarding, parseRoute, tabFor, type Route, type Tab } from './app/route';
import { onboardingDone } from './domain/profile';
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
import { getRepo, defaultSettings } from './modules/training/data';
import { needsOnboarding } from './modules/onboarding/gate';

// Shell: top bar, screen, tab bar (UX design §6.1). Hash routing only (CLAUDE.md): no server rewrites on GitHub Pages.
const TABS: ReadonlyArray<{ tab: Tab; label: string; icon: ReactNode }> = [
  { tab: 'home', label: 'Home', icon: <House /> },
  { tab: 'plan', label: 'Plan', icon: <ClipboardList /> },
  { tab: 'workout', label: 'Train', icon: <Play /> },
  { tab: 'progress', label: 'Progress', icon: <TrendingUp /> },
  { tab: 'more', label: 'More', icon: <Menu /> },
];

// Scroll offset per screen (by hash), so Back returns to where the list was; a screen not seen before starts at the top.
const scrollByHash = new Map<string, number>();
const hashOf = (url: string) => new URL(url).hash;

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
  // Onboarding is required: while it is unfinished the tab bar is hidden and other screens lead back to it.
  const [mustOnboard, setMustOnboard] = useState(false);
  const nextScroll = useRef(0);

  useEffect(() => {
    const readSettings = () => getRepo().then((r) => r.getSettings());
    const enforce = (pending: boolean) => {
      setMustOnboard(pending);
      if (pending && !allowedWhileOnboarding(parseRoute(window.location.hash))) window.location.hash = '#/onboarding';
    };
    // Re-checked on every navigation and pull: finishing onboarding, or signing in on a new phone, releases it.
    const recheck = () =>
      readSettings()
        .then((s) => enforce(!onboardingDone(s ?? defaultSettings())))
        .catch(() => undefined);
    const onHash = (e: HashChangeEvent) => {
      scrollByHash.set(hashOf(e.oldURL), window.scrollY);
      nextScroll.current = scrollByHash.get(hashOf(e.newURL)) ?? 0;
      setRoute(parseRoute(window.location.hash));
      void recheck();
    };
    const refresh = () => readSyncState().then(setSync).catch(() => undefined);
    const onSync = () => {
      void refresh();
      void recheck();
    };
    const onOnline = () => {
      void runSync().catch(() => undefined);
    };
    window.addEventListener('hashchange', onHash);
    window.addEventListener(SYNC_EVENT, onSync);
    window.addEventListener('online', onOnline);
    void refresh();
    // Pull on open: the app shows local data at once, and the server's changes arrive a moment later. The onboarding
    // decision waits for that pull (onboarding/gate.ts explains why).
    needsOnboarding(runSync, readSettings)
      .then(enforce)
      .catch(() => undefined);
    return () => {
      window.removeEventListener('hashchange', onHash);
      window.removeEventListener(SYNC_EVENT, onSync);
      window.removeEventListener('online', onOnline);
    };
  }, []);

  // Hash navigation keeps the old offset, so set it once the new screen is in the DOM.
  // ponytail: a list that fills in after an async read may be too short to restore fully; wait-for-height if it shows up.
  useLayoutEffect(() => window.scrollTo(0, nextScroll.current), [route]);

  const active = tabFor(route);

  return (
    <div className="app">
      <header className="topbar">
        <span className="title">onlyLeveling</span>
        <span className="synced">{sync ? syncLabel(sync) : ''}</span>
      </header>
      <main className="content">
        {mustOnboard && route.screen === 'settings' && <a href="#/onboarding">← Back to setup</a>}
        <Screen route={route} />
      </main>
      <nav className="ui-tabbar" aria-label="Main" hidden={mustOnboard}>
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
