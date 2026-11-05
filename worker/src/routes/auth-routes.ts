// Auth routes (PLAN Phase 4b): sign-up with an invite, sign-in, recovery, sign-out, owner setup, invites.
// Sign-up, sign-in and recovery are rate limited per IP. Errors are JSON with a reason the app can show.
import type { Env } from '../env';
import { authenticate, isOwnerKey, type Principal } from '../auth';
import { AuthError, createInvite, ownerSetup, recover, signIn, signOut, signUp } from '../auth/accounts';
import { allowAttempt, type LimitedAction } from '../auth/rate-limit';
import { bearerToken } from '../auth';
import { corsHeaders } from '../cors';
import { readLimitedText, TooLargeError } from '../request';

const STATUS: Record<string, number> = {
  invalid_credentials: 401,
  invite_invalid: 400,
  bad_input: 400,
  username_taken: 409,
  already_set: 409,
};

function json(body: unknown, status: number, origin: string | null): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
  });
}

async function readBody(req: Request): Promise<Record<string, unknown>> {
  // Size first: a too-large body is refused (413) before it is parsed or held in memory.
  const text = await readLimitedText(req);
  try {
    const parsed: unknown = JSON.parse(text);
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) throw new Error('not an object');
    return parsed as Record<string, unknown>;
  } catch {
    throw new AuthError('bad_input', 'The request body must be a JSON object.');
  }
}

const str = (body: Record<string, unknown>, key: string): string => {
  const v = body[key];
  if (typeof v !== 'string') throw new AuthError('bad_input', `"${key}" must be text.`);
  return v;
};

function clientIp(req: Request): string {
  return req.headers.get('CF-Connecting-IP') ?? 'unknown';
}

// Returns the response for an auth route, or null when the path is not one of them.
export async function handleAuthRoutes(req: Request, env: Env, now: number): Promise<Response | null> {
  const origin = req.headers.get('Origin');
  const path = new URL(req.url).pathname;
  const isAuthPath = path.startsWith('/api/auth/') || path === '/api/invites';
  if (!isAuthPath) return null;

  try {
    if (req.method === 'POST' && path === '/api/auth/signup') {
      await limit(env, 'signup', req, now, origin);
      const b = await readBody(req);
      const r = await signUp(env.DB, { code: str(b, 'code'), username: str(b, 'username'), password: str(b, 'password') }, now);
      return json({ token: r.token, userId: r.userId }, 200, origin);
    }
    if (req.method === 'POST' && path === '/api/auth/signin') {
      await limit(env, 'signin', req, now, origin);
      const b = await readBody(req);
      const r = await signIn(env.DB, { username: str(b, 'username'), password: str(b, 'password') }, now);
      return json({ token: r.token, userId: r.userId }, 200, origin);
    }
    if (req.method === 'POST' && path === '/api/auth/recover') {
      await limit(env, 'recover', req, now, origin);
      const b = await readBody(req);
      const r = await recover(
        env.DB,
        { username: str(b, 'username'), code: str(b, 'code'), newPassword: str(b, 'newPassword') },
        now,
      );
      return json({ token: r.token }, 200, origin);
    }
    if (req.method === 'POST' && path === '/api/auth/signout') {
      const principal = await authenticate(req, env, now);
      if (!principal) return json({ error: 'unauthorized' }, 401, origin);
      const token = bearerToken(req);
      if (token) await signOut(env.DB, token);
      return json({ ok: true }, 200, origin);
    }
    if (req.method === 'POST' && path === '/api/auth/owner-setup') {
      if (!isOwnerKey(req, env)) return json({ error: 'unauthorized' }, 401, origin);
      const b = await readBody(req);
      await ownerSetup(env.DB, { username: str(b, 'username'), password: str(b, 'password') }, now);
      return json({ ok: true }, 200, origin);
    }
    if (req.method === 'POST' && path === '/api/invites') {
      const principal: Principal | null = await authenticate(req, env, now);
      if (!principal) return json({ error: 'unauthorized' }, 401, origin);
      // Shown once; only its hash is stored.
      return json({ code: await createInvite(env.DB, principal.userId, now) }, 200, origin);
    }
  } catch (e) {
    if (e instanceof AuthError) {
      return json({ error: e.message, code: e.code }, STATUS[e.code] ?? 400, origin);
    }
    if (e instanceof TooLargeError) {
      return json({ error: 'body too large' }, 413, origin);
    }
    if (e instanceof RateLimited) {
      return json({ error: 'Too many attempts. Wait 15 minutes and try again.', code: 'rate_limited' }, 429, origin);
    }
    throw e;
  }
  return json({ error: 'not found' }, 404, origin);
}

async function limit(env: Env, action: LimitedAction, req: Request, now: number, origin: string | null): Promise<void> {
  if (!(await allowAttempt(env.DB, action, clientIp(req), now))) {
    throw new RateLimited(origin);
  }
}

class RateLimited extends Error {
  constructor(readonly origin: string | null) {
    super('too many attempts');
  }
}
