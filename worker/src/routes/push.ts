// /api/push/* (PLAN Phase 9). Stores the device's subscription, the reminder setting, and at most one pending rest
// alert per user. Sending happens in the cron job (push/run.ts). Auth is checked by the router.
import type { Env } from '../env';
import type { Principal } from '../auth';
import type { SlotHandler } from './index';
import { corsHeaders } from '../cors';
import { readLimitedText, TooLargeError } from '../request';
import { PUSH } from '../config';
import { validTimeZone } from '../push/schedule';
import { vapidUsable } from '../push/run';

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
// The push services browsers use: Google (Chrome, Android), Mozilla, Apple (Safari, iOS), Microsoft.
const PUSH_SERVICE =
  /^https:\/\/(fcm\.googleapis\.com|updates\.push\.services\.mozilla\.com|web\.push\.apple\.com|[a-z0-9-]+\.notify\.windows\.com)\/./;

export const pushSlot: SlotHandler = async (req: Request, env: Env, principal: Principal) => {
  const url = new URL(req.url);
  if (!url.pathname.startsWith('/api/push/')) return null;
  const origin = req.headers.get('Origin');
  const send = (body: unknown, status: number) =>
    new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) } });
  const uid = principal.userId;
  const now = Date.now();

  if (url.pathname === '/api/push/rest' && req.method === 'DELETE') {
    await env.DB.prepare('DELETE FROM rest_alerts WHERE user_id = ?').bind(uid).run();
    return send({ ok: true }, 200);
  }

  if (req.method !== 'POST') return send({ error: 'method not allowed' }, 405);
  // Without the keys nothing would ever be sent. Say so now, rather than store a subscription that does nothing.
  if (!(await vapidUsable(env))) return send({ error: 'push is not set up on the server yet' }, 503);
  let body: unknown;
  try {
    body = JSON.parse(await readLimitedText(req));
  } catch (e) {
    return send({ error: e instanceof TooLargeError ? 'body too large' : 'bad json' }, e instanceof TooLargeError ? 413 : 400);
  }

  if (url.pathname === '/api/push/subscribe') {
    if (!isObj(body) || typeof body.endpoint !== 'string' || !isObj(body.keys)) return send({ error: 'bad request' }, 400);
    const { endpoint, keys } = body;
    const p256dh = keys.p256dh;
    const auth = keys.auth;
    // Only the push services browsers use. Otherwise the Worker would POST, signed, to any host a user names.
    if (typeof endpoint !== 'string' || !PUSH_SERVICE.test(endpoint) || typeof p256dh !== 'string' || typeof auth !== 'string') {
      return send({ error: 'bad request' }, 400);
    }
    if (p256dh.length > 200 || auth.length > 100) return send({ error: 'bad request' }, 400);
    // Stored once per device endpoint; the newest keys win.
    await env.DB.prepare(
      `INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth, created_at) VALUES (?, ?, ?, ?, ?)
       ON CONFLICT (user_id, endpoint) DO UPDATE SET p256dh = excluded.p256dh, auth = excluded.auth`,
    )
      .bind(uid, endpoint, p256dh, auth, now)
      .run();
    return send({ ok: true }, 200);
  }

  if (url.pathname === '/api/push/unsubscribe') {
    if (!isObj(body) || typeof body.endpoint !== 'string') return send({ error: 'bad request' }, 400);
    await env.DB.prepare('DELETE FROM push_subscriptions WHERE user_id = ? AND endpoint = ?').bind(uid, body.endpoint).run();
    return send({ ok: true }, 200);
  }

  if (url.pathname === '/api/push/reminder') {
    if (!isObj(body) || typeof body.enabled !== 'boolean' || typeof body.time !== 'string' || typeof body.tz !== 'string') {
      return send({ error: 'bad request' }, 400);
    }
    if (!TIME.test(body.time) || body.tz.length > 64 || !validTimeZone(body.tz)) return send({ error: 'bad time or zone' }, 400);
    await env.DB.prepare(
      `INSERT INTO reminders (user_id, enabled, time, tz) VALUES (?, ?, ?, ?)
       ON CONFLICT (user_id) DO UPDATE SET enabled = excluded.enabled, time = excluded.time, tz = excluded.tz`,
    )
      .bind(uid, body.enabled ? 1 : 0, body.time, body.tz)
      .run();
    return send({ ok: true }, 200);
  }

  if (url.pathname === '/api/push/rest') {
    if (!isObj(body) || typeof body.fireAt !== 'number' || !Number.isFinite(body.fireAt)) return send({ error: 'bad request' }, 400);
    const fireAt = body.fireAt;
    if (fireAt < now - 1000 || fireAt > now + PUSH.restMaxAheadMs) return send({ error: 'fireAt out of range' }, 400);
    // One pending rest per user: a new rest replaces the old one.
    await env.DB.prepare(
      `INSERT INTO rest_alerts (user_id, fire_at) VALUES (?, ?)
       ON CONFLICT (user_id) DO UPDATE SET fire_at = excluded.fire_at`,
    )
      .bind(uid, fireAt)
      .run();
    return send({ ok: true }, 200);
  }

  return send({ error: 'not found' }, 404);
};
