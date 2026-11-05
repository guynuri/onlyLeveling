// Worker entry: a small router. Every /api route except /api/health needs the bearer token.
import type { Env } from './env';
import { authenticate } from './auth';
import { corsHeaders } from './cors';
import { applyPush, exportAll, parseOps, pull, ValidationError } from './sync';
import { routeSlots } from './routes';

const MAX_BODY_BYTES = 1_000_000;

function json(body: unknown, status: number, origin: string | null): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
  });
}

export default {
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

    const principal = authenticate(req, env);
    if (!principal) {
      return json({ error: 'unauthorized' }, 401, origin);
    }

    const slotted = await routeSlots(req, env, principal);
    if (slotted) return slotted;

    try {
      if (url.pathname === '/api/sync/push' && req.method === 'POST') {
        // Refuse by the declared length first, so a large body is never read into memory.
        const declared = Number(req.headers.get('Content-Length') ?? '0');
        if (declared > MAX_BODY_BYTES) return json({ error: 'body too large' }, 413, origin);
        const text = await req.text();
        // Measured in bytes, the unit the limit is written in.
        if (new TextEncoder().encode(text).byteLength > MAX_BODY_BYTES) {
          return json({ error: 'body too large' }, 413, origin);
        }
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
      if (e instanceof ValidationError || e instanceof SyntaxError) {
        return json({ error: e.message }, 400, origin);
      }
      // Never leak internals; the client shows "sync failed" and keeps the op in its outbox.
      return json({ error: 'server error' }, 500, origin);
    }
    return json({ error: 'not found' }, 404, origin);
  },
} satisfies ExportedHandler<Env>;
