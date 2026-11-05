// Hash routing only (CLAUDE.md): GitHub Pages has no server rewrites. Pure, so it is tested.
export type Route =
  | { screen: 'today' }
  | { screen: 'plan' }
  | { screen: 'library' }
  | { screen: 'exercise'; id: string }
  | { screen: 'history' }
  | { screen: 'settings' }
  | { screen: 'credits' };

const TABS = ['today', 'plan', 'library', 'history', 'settings'] as const satisfies readonly Route['screen'][];

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
  if (head === 'library') return { screen: 'library' };
  if (head === 'credits') return { screen: 'credits' };
  const tab = TABS.find((t) => t === head);
  return tab ? { screen: tab } : { screen: 'today' };
}
