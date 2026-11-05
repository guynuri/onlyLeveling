// Hash routing only (CLAUDE.md): GitHub Pages has no server rewrites. Pure, so it is tested.
export type Route =
  | { screen: 'today' }
  | { screen: 'library' }
  | { screen: 'exercise'; id: string }
  | { screen: 'history' }
  | { screen: 'progress' }
  | { screen: 'settings' }
  | { screen: 'credits' };

const TABS = ['today', 'library', 'history', 'progress', 'settings'] as const satisfies readonly Route['screen'][];

export function parseRoute(hash: string): Route {
  const path = hash.replace(/^#\/?/, '');
  const [head, ...rest] = path.split('/');
  if (head === 'library' && rest.length > 0 && rest[0] !== '') {
    return { screen: 'exercise', id: decodeURIComponent(rest[0]) };
  }
  if (head === 'library') return { screen: 'library' };
  if (head === 'credits') return { screen: 'credits' };
  const tab = TABS.find((t) => t === head);
  return tab ? { screen: tab } : { screen: 'today' };
}
