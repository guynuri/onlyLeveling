import { describe, it, expect, beforeAll, beforeEach, vi, afterEach } from 'vitest';
import { env } from 'cloudflare:test';
import { runDue } from './run';
import { b64uEncode, type VapidConfig } from './webpush';
import { pushSlot } from '../routes/push';
import type { Env } from '../env';
import type { Principal } from '../auth';

const db = (env as unknown as Env).DB;

// A real P-256 private key, made once per run: the routes check that the key imports. Test-only, never stored.
let TEST_JWK = {} as JsonWebKey;
beforeAll(async () => {
  TEST_JWK = (await vapid()).privateJwk;
});
const U = 'u_push';
const NOW = Date.parse('2026-11-05T16:00:00Z'); // 18:00 in Asia/Jerusalem, a Thursday

async function vapid(): Promise<VapidConfig> {
  const pair = (await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify'])) as CryptoKeyPair;
  const jwk = (await crypto.subtle.exportKey('jwk', pair.privateKey)) as JsonWebKey;
  const raw = new Uint8Array((await crypto.subtle.exportKey('raw', pair.publicKey)) as ArrayBuffer);
  return { publicKey: b64uEncode(raw), privateJwk: jwk, subject: 'https://example.test/' };
}

beforeEach(async () => {
  for (const t of ['push_subscriptions', 'reminders', 'rest_alerts', 'settings', 'workouts']) {
    await db.prepare(`DELETE FROM ${t}`).run();
  }
});
afterEach(() => {
  vi.unstubAllGlobals();
});

// A device with real keys, so a send gets as far as the push service.
const subscribe = async (endpoint = 'https://push.example.test/dev1') => {
  const pair = (await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits'])) as CryptoKeyPair;
  const p256dh = b64uEncode(new Uint8Array((await crypto.subtle.exportKey('raw', pair.publicKey)) as ArrayBuffer));
  const auth = b64uEncode(crypto.getRandomValues(new Uint8Array(16)));
  await db
    .prepare('INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth, created_at) VALUES (?, ?, ?, ?, ?)')
    .bind(U, endpoint, p256dh, auth, 1)
    .run();
};

describe('rest alerts', () => {
  it('when push is not configured, nothing is sent and the alert is kept, not lost', async () => {
    await db.prepare('INSERT INTO rest_alerts (user_id, fire_at) VALUES (?, ?)').bind(U, NOW - 1000).run();
    const r = await runDue(db, null, NOW);
    expect(r).toEqual({ sent: 0, removed: 0 });
    expect(await db.prepare('SELECT COUNT(*) AS n FROM rest_alerts').first()).toEqual({ n: 1 });
  });

  it('a due alert is sent once and cleared; a device that is gone is removed', async () => {
    await subscribe();
    await db.prepare('INSERT INTO rest_alerts (user_id, fire_at) VALUES (?, ?)').bind(U, NOW - 1000).run();
    vi.stubGlobal('fetch', async () => new Response(null, { status: 410 }));
    const r = await runDue(db, await vapid(), NOW);
    expect(r).toEqual({ sent: 0, removed: 1 });
    expect(await db.prepare('SELECT COUNT(*) AS n FROM rest_alerts').first()).toEqual({ n: 0 });
    expect(await db.prepare('SELECT COUNT(*) AS n FROM push_subscriptions').first()).toEqual({ n: 0 });
  });

  it('a send that does not reach the push service is counted; a later success resets the count', async () => {
    await subscribe();
    const failing = async () => {
      await db.prepare('INSERT INTO rest_alerts (user_id, fire_at) VALUES (?, ?)').bind(U, NOW - 1000).run();
      vi.stubGlobal('fetch', async () => new Response(null, { status: 500 }));
      await runDue(db, await vapid(), NOW);
    };
    await failing();
    await failing();
    expect(await db.prepare('SELECT failures FROM push_subscriptions WHERE user_id = ?').bind(U).first()).toEqual({ failures: 2 });

    await db.prepare('INSERT INTO rest_alerts (user_id, fire_at) VALUES (?, ?)').bind(U, NOW - 1000).run();
    vi.stubGlobal('fetch', async () => new Response(null, { status: 201 }));
    await runDue(db, await vapid(), NOW);
    expect(await db.prepare('SELECT failures FROM push_subscriptions WHERE user_id = ?').bind(U).first()).toEqual({ failures: 0 });
  });

  it('an alert more than the limit late is dropped, not sent', async () => {
    await subscribe();
    await db.prepare('INSERT INTO rest_alerts (user_id, fire_at) VALUES (?, ?)').bind(U, NOW - 60 * 60_000).run();
    const fetchSpy = vi.fn(async () => new Response(null, { status: 201 }));
    vi.stubGlobal('fetch', fetchSpy);
    await runDue(db, await vapid(), NOW);
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(await db.prepare('SELECT COUNT(*) AS n FROM rest_alerts').first()).toEqual({ n: 0 });
  });
});

describe('workout reminder', () => {
  const setReminder = () =>
    db.prepare('INSERT INTO reminders (user_id, enabled, time, tz, last_sent_day) VALUES (?, 1, ?, ?, NULL)').bind(U, '18:00', 'Asia/Jerusalem').run();
  const setPlan = (days: number) =>
    db.prepare('INSERT INTO settings (user_id, data, updated_at, server_at) VALUES (?, ?, 1, 1)').bind(U, JSON.stringify({ daysPerWeek: days })).run();
  const addWorkout = (start: number) =>
    db.prepare('INSERT INTO workouts (user_id, id, data, updated_at, server_at) VALUES (?, ?, ?, ?, 1)').bind(U, `w${start}`, JSON.stringify({ id: `w${start}`, start }), NOW).run();

  it('sends at the set minute on a training day while the week is short', async () => {
    await subscribe();
    await setReminder();
    await setPlan(3);
    await addWorkout(NOW - 2 * 86_400_000); // one finished session earlier this week (Tuesday)
    const fetchSpy = vi.fn(async () => new Response(null, { status: 201 }));
    vi.stubGlobal('fetch', fetchSpy);
    const r = await runDue(db, await vapid(), NOW);
    expect(r.sent).toBe(1);
    expect(fetchSpy).toHaveBeenCalledOnce();
    expect(await db.prepare('SELECT last_sent_day FROM reminders WHERE user_id = ?').bind(U).first()).toEqual({ last_sent_day: '2026-11-05' });
  });

  it('does not send once this week’s sessions are done', async () => {
    await subscribe();
    await setReminder();
    await setPlan(2);
    await addWorkout(NOW - 2 * 86_400_000);
    await addWorkout(NOW - 86_400_000);
    const fetchSpy = vi.fn(async () => new Response(null, { status: 201 }));
    vi.stubGlobal('fetch', fetchSpy);
    await runDue(db, await vapid(), NOW);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('does not send a second time on the same local day', async () => {
    await subscribe();
    await setReminder();
    await setPlan(3);
    await db.prepare("UPDATE reminders SET last_sent_day = '2026-11-05' WHERE user_id = ?").bind(U).run();
    const fetchSpy = vi.fn(async () => new Response(null, { status: 201 }));
    vi.stubGlobal('fetch', fetchSpy);
    await runDue(db, await vapid(), NOW);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe('push routes: input rules', () => {
  const principal = { userId: U } as unknown as Principal;
  // The routes need the keys to be set on the server; the test environment has them.
  const keyed = (): Env => ({ ...(env as unknown as Env), VAPID_PUBLIC: 'pub', VAPID_PRIVATE_JWK: JSON.stringify(TEST_JWK) }) as Env;
  const call = (path: string, body: unknown, method = 'POST', e: Env = keyed()) =>
    pushSlot(
      new Request(`https://api.test${path}`, {
        method,
        headers: { 'Content-Type': 'application/json', Origin: 'https://guynuri.github.io' },
        body: method === 'DELETE' ? undefined : JSON.stringify(body),
      }),
      e,
      principal,
    ) as Promise<Response>;

  it('a private key that is valid JSON but not a key gets 503 at subscribe time', async () => {
    const bad = { ...(env as unknown as Env), VAPID_PUBLIC: 'pub', VAPID_PRIVATE_JWK: '{}' } as Env;
    const res = await call('/api/push/subscribe', { endpoint: 'https://fcm.googleapis.com/fcm/send/x', keys: { p256dh: 'a', auth: 'b' } }, 'POST', bad);
    expect(res.status).toBe(503);
  });

  it('only the browsers’ push services are accepted as endpoints', async () => {
    const keys = { p256dh: 'a', auth: 'b' };
    expect((await call('/api/push/subscribe', { endpoint: 'https://example.com/x', keys })).status).toBe(400);
    expect((await call('/api/push/subscribe', { endpoint: 'https://fcm.googleapis.com/fcm/send/x', keys })).status).toBe(200);
    expect((await call('/api/push/subscribe', { endpoint: 'https://web.push.apple.com/abc', keys })).status).toBe(200);
  });

  it('without the server keys, subscribing says so (503) and stores nothing', async () => {
    const noKeys = { ...(env as unknown as Env), VAPID_PUBLIC: undefined, VAPID_PRIVATE_JWK: undefined } as Env;
    const res = await call('/api/push/subscribe', { endpoint: 'https://push.example.test/x', keys: { p256dh: 'a', auth: 'b' } }, 'POST', noKeys);
    expect(res.status).toBe(503);
    expect(await db.prepare('SELECT COUNT(*) AS n FROM push_subscriptions').first()).toEqual({ n: 0 });
  });

  it('a subscription is stored once per endpoint', async () => {
    const sub = { endpoint: 'https://fcm.googleapis.com/fcm/send/dev1', keys: { p256dh: 'BPk', auth: 'auth' } };
    expect((await call('/api/push/subscribe', sub)).status).toBe(200);
    expect((await call('/api/push/subscribe', sub)).status).toBe(200);
    expect(await db.prepare('SELECT COUNT(*) AS n FROM push_subscriptions WHERE user_id = ?').bind(U).first()).toEqual({ n: 1 });
  });

  it('rejects a non-https endpoint', async () => {
    const res = await call('/api/push/subscribe', { endpoint: 'http://push.example.test/x', keys: { p256dh: 'a', auth: 'b' } });
    expect(res.status).toBe(400);
  });

  it('rejects a bad time or an unknown zone for the reminder', async () => {
    expect((await call('/api/push/reminder', { enabled: true, time: '25:00', tz: 'Asia/Jerusalem' })).status).toBe(400);
    expect((await call('/api/push/reminder', { enabled: true, time: '18:00', tz: 'Mars/Olympus' })).status).toBe(400);
    expect((await call('/api/push/reminder', { enabled: true, time: '18:00', tz: 'Asia/Jerusalem' })).status).toBe(200);
  });

  it('a rest alert must end now or later, and within the limit ahead', async () => {
    expect((await call('/api/push/rest', { fireAt: Date.now() - 60_000 })).status).toBe(400);
    expect((await call('/api/push/rest', { fireAt: Date.now() + 10 * 60 * 60_000 })).status).toBe(400);
    expect((await call('/api/push/rest', { fireAt: Date.now() + 90_000 })).status).toBe(200);
  });

  it('the status route reports the failure count for this user', async () => {
    await subscribe();
    await db.prepare('UPDATE push_subscriptions SET failures = 3 WHERE user_id = ?').bind(U).run();
    const res = await pushSlot(
      new Request('https://api.test/api/push/status', { method: 'GET', headers: { Origin: 'https://guynuri.github.io' } }),
      { ...(env as unknown as Env), VAPID_PUBLIC: 'pub', VAPID_PRIVATE_JWK: JSON.stringify(TEST_JWK) } as Env,
      { userId: U } as unknown as Principal,
    );
    expect(await (res as Response).json()).toEqual({ failures: 3 });
  });

  it('a rest, then a cancel (workout finished), then the due run sends nothing', async () => {
    await subscribe();
    const principal = { userId: U } as unknown as Principal;
    const fireAt = Date.now() + 1_000;
    const post = (path: string, body: unknown, method = 'POST') =>
      pushSlot(
        new Request(`https://api.test${path}`, {
          method,
          headers: { 'Content-Type': 'application/json', Origin: 'https://guynuri.github.io' },
          body: method === 'DELETE' ? undefined : JSON.stringify(body),
        }),
        { ...(env as unknown as Env), VAPID_PUBLIC: 'pub', VAPID_PRIVATE_JWK: JSON.stringify(TEST_JWK) } as Env,
        principal,
      ) as Promise<Response>;
    expect((await post('/api/push/rest', { fireAt })).status).toBe(200);
    expect((await post('/api/push/rest', undefined, 'DELETE')).status).toBe(200);
    const fetchSpy = vi.fn(async () => new Response(null, { status: 201 }));
    vi.stubGlobal('fetch', fetchSpy);
    const r = await runDue(db, await vapid(), fireAt + 5_000);
    expect(r.sent).toBe(0);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('a new rest replaces the pending one; cancel clears it', async () => {
    await call('/api/push/rest', { fireAt: Date.now() + 60_000 });
    await call('/api/push/rest', { fireAt: Date.now() + 120_000 });
    expect(await db.prepare('SELECT COUNT(*) AS n FROM rest_alerts').first()).toEqual({ n: 1 });
    await call('/api/push/rest', undefined, 'DELETE');
    expect(await db.prepare('SELECT COUNT(*) AS n FROM rest_alerts').first()).toEqual({ n: 0 });
  });
});
