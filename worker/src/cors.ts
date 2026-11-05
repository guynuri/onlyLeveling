// CORS: exactly the GitHub Pages origin and localhost dev (CLAUDE.md). No wildcard, no credentials (no cookies).
export const ALLOWED_ORIGINS = ['https://guynuri.github.io', 'http://localhost:5173'] as const;

export function corsHeaders(origin: string | null): Record<string, string> {
  if (origin === null || !(ALLOWED_ORIGINS as readonly string[]).includes(origin)) return {};
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    'Access-Control-Max-Age': '600',
    Vary: 'Origin',
  };
}
