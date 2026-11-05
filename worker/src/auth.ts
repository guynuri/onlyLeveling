// Auth (CLAUDE.md): bearer token in the Authorization header, never cookies.
// Two ways in: a session token from sign-in (Phase 4b), and the owner key (BOOTSTRAP_TOKEN), which keeps the
// Phase 4a data reachable. Neither is a cookie.
import type { Env } from './env';
import { resolveSession } from './auth/accounts';

export interface Principal {
  userId: string;
}

export type AuthEnv = Pick<Env, 'DB' | 'BOOTSTRAP_TOKEN'>;

export function bearerToken(req: Request): string | null {
  const h = req.headers.get('Authorization');
  if (!h) return null;
  const m = /^Bearer (.+)$/.exec(h);
  return m ? m[1] : null;
}

// Constant-time comparison, so a wrong key leaks nothing through timing.
function equal(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function authenticate(req: Request, env: AuthEnv, now: number): Promise<Principal | null> {
  const token = bearerToken(req);
  if (!token) return null;
  if (env.BOOTSTRAP_TOKEN && equal(token, env.BOOTSTRAP_TOKEN)) return { userId: 'u_bootstrap' };
  const userId = await resolveSession(env.DB, token, now);
  return userId ? { userId } : null;
}

// Only the owner key authenticates here (owner setup and nothing else).
export function isOwnerKey(req: Request, env: AuthEnv): boolean {
  const token = bearerToken(req);
  return !!token && !!env.BOOTSTRAP_TOKEN && equal(token, env.BOOTSTRAP_TOKEN);
}
