// Hash routing only (CLAUDE.md): GitHub Pages has no server rewrites. Pure, so it is tested.
export type Route =
  | { screen: 'home' }
  | { screen: 'plan' }
  | { screen: 'workout' }
  | { screen: 'progress' }
  | { screen: 'more' }
  | { screen: 'library' }
  | { screen: 'exercise'; id: string }
  | { screen: 'history' }
  | { screen: 'settings' }
  | { screen: 'credits' }
  | { screen: 'onboarding' }; // first run; reached by the gate in App, not a tab (PLAN Phase 7)

export type Tab = 'home' | 'plan' | 'workout' | 'progress' | 'more';

// Screens reached by their own name. 'exercise' needs an id and is handled separately.
const SIMPLE = [
  'home',
  'plan',
  'workout',
  'progress',
  'more',
  'library',
  'history',
  'settings',
  'credits',
  'onboarding',
] as const satisfies readonly Exclude<Route['screen'], 'exercise'>[];

function safeDecode(s: string): string | null {
  try {
    return decodeURIComponent(s);
  } catch {
    return null;
  }
}

export function parseRoute(hash: string): Route {
  const path = hash.replace(/^#\/?/, '');
  const [head, ...rest] = path.split('/');
  if (head === 'library' && rest.length > 0 && rest[0] !== '') {
    const id = safeDecode(rest[0]);
    // A malformed escape (e.g. "100%") must not throw during render: fall back to the list.
    return id === null ? { screen: 'library' } : { screen: 'exercise', id };
  }
  // Unknown hashes and old #/today links (push notifications, bookmarks) land on Home.
  const screen = SIMPLE.find((s) => s === head);
  return screen ? { screen } : { screen: 'home' };
}

// Which bottom tab is highlighted for a route: More owns its sub-screens, onboarding sits under Home.
export function tabFor(route: Route): Tab {
  switch (route.screen) {
    case 'library':
    case 'exercise':
    case 'history':
    case 'settings':
    case 'credits':
      return 'more';
    case 'onboarding':
      return 'home';
    default:
      return route.screen;
  }
}
