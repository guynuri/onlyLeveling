// Auth (CLAUDE.md): bearer token in the Authorization header, never cookies. Phase 4a: one bootstrap account.
// Only the secret this module reads; the rest of Env is not needed to authenticate.
export interface AuthEnv {
  BOOTSTRAP_TOKEN: string;
}

export interface Principal {
  userId: string;
}

export function bearerToken(req: Request): string | null {
  const h = req.headers.get('Authorization');
  if (!h) return null;
  const m = /^Bearer (.+)$/.exec(h);
  return m ? m[1] : null;
}

// Constant-time comparison, so a wrong token leaks nothing through timing.
function equal(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export function authenticate(req: Request, env: AuthEnv): Principal | null {
  const token = bearerToken(req);
  if (!token || !env.BOOTSTRAP_TOKEN) return null;
  return equal(token, env.BOOTSTRAP_TOKEN) ? { userId: 'u_bootstrap' } : null;
}
