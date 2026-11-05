import { useEffect, useState } from 'react';
import { parseRoute, type Route } from './app/route';
import ExerciseDetail from './modules/library/ExerciseDetail';
import ExerciseList from './modules/library/ExerciseList';
import CreditsScreen from './modules/library/CreditsScreen';
import { libraryModule } from './modules/library/register';

// Shell: top bar, screen, bottom nav. Hash routing only (CLAUDE.md): no server rewrites on GitHub Pages.
const TABS: ReadonlyArray<{ screen: Route['screen']; label: string }> = [
  { screen: 'today', label: 'Today' },
  { screen: 'library', label: libraryModule.label },
  { screen: 'history', label: 'History' },
  { screen: 'progress', label: 'Progress' },
  { screen: 'settings', label: 'Settings' },
];

// Which bottom tab is highlighted for a route (exercise detail belongs to the Library tab).
function tabFor(route: Route): Route['screen'] {
  return route.screen === 'exercise' ? 'library' : route.screen === 'credits' ? 'settings' : route.screen;
}

function Screen({ route }: { route: Route }) {
  switch (route.screen) {
    case 'library':
      return <ExerciseList />;
    case 'exercise':
      return <ExerciseDetail id={route.id} />;
    case 'credits':
      return <CreditsScreen />;
    case 'settings':
      return (
        <section>
          <h1>Settings</h1>
          <p className="muted">Coming in a later phase.</p>
          <a href="#/credits">Credits</a>
        </section>
      );
    default:
      return (
        <section>
          <h1>{TABS.find((t) => t.screen === route.screen)?.label ?? 'Today'}</h1>
          <p className="muted">Coming in a later phase.</p>
        </section>
      );
  }
}

export default function App() {
  const [route, setRoute] = useState<Route>(() => parseRoute(window.location.hash));

  useEffect(() => {
    const onHash = () => setRoute(parseRoute(window.location.hash));
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const active = tabFor(route);

  return (
    <div className="app">
      <header className="topbar">
        <span className="title">onlyLeveling</span>
        <span className="synced">last synced: never</span>
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
