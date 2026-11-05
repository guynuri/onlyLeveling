// Worker entry: a small router. Every /api route except /api/health needs the bearer token.
import type { Env } from './env';
import { authenticate } from './auth';
import { corsHeaders } from './cors';
import { applyPush, exportAll, parseOps, pull, ValidationError } from './sync';
import { routeSlots } from './routes';
import { handleAuthRoutes } from './routes/auth-routes';
import { readLimitedText, TooLargeError } from './request';
import { runDue, vapidFromEnv } from './push/run';

function json(body: unknown, status: number, origin: string | null): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
  });
}

export default {
  // Cron (wrangler.toml [triggers], every minute): due rest alerts and workout reminders (PLAN Phase 9).
  async scheduled(_event: ScheduledController, env: Env): Promise<void> {
    await runDue(env.DB, vapidFromEnv(env), Date.now());
  },

  async fetch(req: Request, env: Env): Promise<Response> {
    const origin = req.headers.get('Origin');
    const url = new URL(req.url);

    if (req.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }
    if (url.pathname === '/api/health' && req.method === 'GET') {
      return json({ ok: true }, 200, origin);
    }
    if (!url.pathname.startsWith('/api/')) {
      return json({ error: 'not found' }, 404, origin);
    }

    const now = Date.now();
    // Sign-up, sign-in and recovery need no token. They handle their own errors.
    const authRoute = await handleAuthRoutes(req, env, now);
    if (authRoute) return authRoute;

    const principal = await authenticate(req, env, now);
    if (!principal) {
      return json({ error: 'unauthorized' }, 401, origin);
    }

    try {
      // Inside the try: a slot that throws still gets a JSON error and CORS headers.
      const slotted = await routeSlots(req, env, principal);
      if (slotted) return slotted;

      if (url.pathname === '/api/sync/push' && req.method === 'POST') {
        const text = await readLimitedText(req);
        const ops = parseOps(JSON.parse(text));
        const result = await applyPush(env.DB, principal.userId, ops, Date.now());
        return json(result, 200, origin);
      }
      if (url.pathname === '/api/sync/pull' && req.method === 'GET') {
        const since = Number(url.searchParams.get('since') ?? '0');
        if (!Number.isFinite(since) || since < 0) return json({ error: 'bad since' }, 400, origin);
        return json(await pull(env.DB, principal.userId, since), 200, origin);
      }
      if (url.pathname === '/api/export' && req.method === 'GET') {
        return json(await exportAll(env.DB, principal.userId), 200, origin);
      }
    } catch (e) {
      if (e instanceof TooLargeError) {
        return json({ error: 'body too large' }, 413, origin);
      }
      if (e instanceof ValidationError || e instanceof SyntaxError) {
        return json({ error: e.message }, 400, origin);
      }
      // Never leak internals; the client shows "sync failed" and keeps the op in its outbox.
      return json({ error: 'server error' }, 500, origin);
    }
    return json({ error: 'not found' }, 404, origin);
  },
} satisfies ExportedHandler<Env>;
