import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { openAppDb, type Db } from '../db/idb';
import { createRepo } from './idb-repo';
import { createOutbox } from './outbox';
import { createSyncedRepo } from './synced-repo';
import { syncNow, withLatestConfig, loadSyncState, saveSyncState, fetchExport, type SyncState } from './sync-engine';

let db: Db;
let n = 0;

beforeEach(async () => {
  db = await openAppDb(`test-engine-${n++}`);
});

const CONFIG = { baseUrl: 'https://api.example', token: 'tok' };
const FRESH: SyncState = { config: CONFIG, lastSyncedAt: null, cursor: 0, lastError: null, pendingRevoke: [] };

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

// A fake server: records what was pushed and answers pulls from a fixed list.
function fakeServer(opts: { pullFails?: boolean; serverTime?: number } = {}) {
  const pushed: unknown[] = [];
  const pulls: string[] = [];
  const fetchImpl: typeof fetch = async (url, init) => {
    const u = String(url);
    if (u.endsWith('/api/sync/push')) {
      pushed.push(...(JSON.parse(String(init?.body)) as { ops: unknown[] }).ops);
      return json({ applied: pushed.length, duplicates: 0 });
    }
    if (u.includes('/api/sync/pull')) {
      pulls.push(u);
      if (opts.pullFails) return new Response('{}', { status: 500 });
      return json({
        workouts: [{ id: 'from-server', start: 9, end: 10, entries: [] }],
        settings: { daysPerWeek: 4, restSec: 60, owned: [6] },
        bodyweight: [{ date: '2026-11-01', kg: 80 }],
        serverTime: opts.serverTime ?? 5000,
      });
    }
    return new Response('{}', { status: 404 });
  };
  return { fetch: fetchImpl, pushed, pulls };
}

describe('syncNow', () => {
  it('pushes queued writes, pulls the server changes into the local store, and records the sync', async () => {
    const outbox = createOutbox(db);
    const local = createRepo(db);
    const synced = createSyncedRepo(local, outbox, () => 100);
    await synced.saveWorkout({ id: 'mine', start: 1, end: 2, entries: [] });

    const srv = fakeServer();
    const state = await syncNow({ outbox, local, state: FRESH, fetch: srv.fetch, now: () => 200 });

    expect(srv.pushed).toHaveLength(1);
    expect(await outbox.count()).toBe(0);
    expect((await local.listWorkouts()).map((w) => w.id).sort()).toEqual(['from-server', 'mine']);
    expect(await local.getSettings()).toEqual({ daysPerWeek: 4, restSec: 60, owned: [6] });
    expect(await local.listBodyweight()).toEqual([{ date: '2026-11-01', kg: 80 }]);
    expect(state).toMatchObject({ lastSyncedAt: 200, cursor: 5000, lastError: null });
  });

  it('the next pull asks only for changes after the server time from the last one', async () => {
    const outbox = createOutbox(db);
    const srv = fakeServer({ serverTime: 5000 });
    const first = await syncNow({ outbox, local: createRepo(db), state: FRESH, fetch: srv.fetch, now: () => 1 });
    await syncNow({ outbox, local: createRepo(db), state: first, fetch: srv.fetch, now: () => 2 });
    expect(srv.pulls[0]).toContain('since=0');
    expect(srv.pulls[1]).toContain('since=5000');
  });

  it('a failed pull keeps the last successful sync time and shows the error', async () => {
    const outbox = createOutbox(db);
    const before: SyncState = { ...FRESH, lastSyncedAt: 42, cursor: 40 };
    const srv = fakeServer({ pullFails: true });
    const state = await syncNow({ outbox, local: createRepo(db), state: before, fetch: srv.fetch, now: () => 300 });
    expect(state.lastSyncedAt).toBe(42);
    expect(state.cursor).toBe(40);
    expect(state.lastError).toMatch(/HTTP 500/);
  });

  it('a network failure on push keeps the write queued and reports it; nothing is lost', async () => {
    const outbox = createOutbox(db);
    await createSyncedRepo(createRepo(db), outbox, () => 1).saveWorkout({ id: 'w', start: 1, end: 2, entries: [] });
    const state = await syncNow({
      outbox,
      local: createRepo(db),
      state: FRESH,
      fetch: async () => {
        throw new TypeError('Failed to fetch');
      },
      now: () => 2,
    });
    expect(await outbox.count()).toBe(1);
    expect(state.lastError).toBe('Failed to fetch');
    expect(state.lastSyncedAt).toBeNull();
  });

  it('with no config it does nothing and says so', async () => {
    const r = await syncNow({ outbox: createOutbox(db), local: createRepo(db), state: { ...FRESH, config: null }, fetch: fakeServer().fetch, now: () => 1 });
    expect(r.lastError).toBe('Not signed in to a server.');
    expect(r.lastSyncedAt).toBeNull();
  });
});

describe('a pull never overwrites a record that has a queued local write', () => {
  it('a backed-off local edit survives a pull that returns an older copy of the same record', async () => {
    const outbox = createOutbox(db);
    const local = createRepo(db);
    const synced = createSyncedRepo(local, outbox, () => 0);
    await synced.saveWorkout({ id: 'w-pending', start: 1, end: 2, entries: [{ exerciseId: 'mine', planned: { w: 8, reps: 8, sets: 1 }, sets: [] }] });
    // The push failed earlier, so this row is backing off: not due at now=0.
    const [row] = await outbox.peek(10_000_000);
    await outbox.fail(row.id, 'offline', 0);
    expect(await outbox.peek(0)).toHaveLength(0);

    // The server answers the pull with an older copy of the pending record, plus one unrelated record.
    const serverCopy = async (url: string | URL | Request) => {
      if (String(url).includes('/api/sync/pull')) {
        return json({
          workouts: [
            { id: 'w-pending', start: 1, end: 2, entries: [{ exerciseId: 'server-old', planned: { w: 1, reps: 1, sets: 1 }, sets: [] }] },
            { id: 'from-server', start: 9, end: 10, entries: [] },
          ],
          settings: null,
          bodyweight: [],
          serverTime: 5000,
        });
      }
      return json({ applied: 0, duplicates: 0 });
    };
    await syncNow({ outbox, local, state: FRESH, fetch: serverCopy as typeof fetch, now: () => 0 });

    const kept = (await local.listWorkouts()).find((w) => w.id === 'w-pending');
    expect(kept?.entries[0].exerciseId).toBe('mine');
    // Other records from the server still arrive.
    expect((await local.listWorkouts()).map((w) => w.id)).toContain('from-server');
  });
});

describe('sign-out and sign-in are not undone by a sync already running', () => {
  it('the latest stored config wins over the one the sync started with', () => {
    const started: SyncState = { ...FRESH, config: CONFIG };
    const signedOut: SyncState = { ...FRESH, config: null };
    const finished: SyncState = { ...started, lastSyncedAt: 9, cursor: 8 };
    expect(withLatestConfig(finished, signedOut).config).toBeNull();
    const newConfig = { baseUrl: 'https://other.example', token: 'new' };
    expect(withLatestConfig(finished, { ...signedOut, config: newConfig }).config).toEqual(newConfig);
    // Sync results are kept.
    expect(withLatestConfig(finished, signedOut)).toMatchObject({ lastSyncedAt: 9, cursor: 8 });
  });
  it('a session the server ended during this sync stays ended', () => {
    const started: SyncState = { ...FRESH, config: CONFIG };
    const ended: SyncState = { ...started, config: null, lastError: 'Your session has ended. Sign in again.' };
    expect(withLatestConfig(ended, started, started).config).toBeNull();
    const other = { baseUrl: 'https://other.example', token: 'new' };
    expect(withLatestConfig(ended, { ...started, config: other }, started).config).toEqual(other); // a new sign-in wins
  });
});

describe('a session the server has ended', () => {
  it('a 401 from the server ends the session on this device, so the screen asks to sign in again', async () => {
    const outbox = createOutbox(db);
    await createSyncedRepo(createRepo(db), outbox, () => 0).saveWorkout({ id: 'w', start: 1, end: 2, entries: [] });
    const dead = (async () => json({ error: 'unauthorized' }, 401)) as unknown as typeof fetch;
    const state = await syncNow({ outbox, local: createRepo(db), state: FRESH, fetch: dead, now: () => 1 });
    expect(state.config).toBeNull();
    expect(state.lastError).toMatch(/session has ended/i);
    // The queued write is kept: it goes out when the user signs in again.
    expect(await outbox.count()).toBe(1);
  });
});

describe('a sign-out that could not reach the server is retried', () => {
  it('the next sync revokes the token that was queued for revoking', async () => {
    const outbox = createOutbox(db);
    const seen: string[] = [];
    const server = (async (url: string | URL | Request, init?: RequestInit) => {
      if (String(url).endsWith('/api/auth/signout')) {
        seen.push(String((init?.headers as Record<string, string>).Authorization));
        return json({ ok: true });
      }
      if (String(url).includes('/api/sync/pull')) return json({ workouts: [], settings: null, bodyweight: [], serverTime: 9 });
      return json({ applied: 0, duplicates: 0 });
    }) as typeof fetch;
    const state = await syncNow({
      outbox,
      local: createRepo(db),
      state: { ...FRESH, pendingRevoke: ['old-token'] },
      fetch: server,
      now: () => 1,
    });
    expect(seen).toEqual(['Bearer old-token']);
    expect(state.pendingRevoke).toEqual([]);
  });
});

describe('sync state storage', () => {
  it('round-trips the config and cursor through the meta store', async () => {
    expect(await loadSyncState(db)).toEqual({ config: null, lastSyncedAt: null, cursor: 0, lastError: null, pendingRevoke: [] });
    await saveSyncState(db, { ...FRESH, lastSyncedAt: 7, cursor: 9 });
    expect(await loadSyncState(db)).toMatchObject({ config: CONFIG, lastSyncedAt: 7, cursor: 9 });
  });
});

describe('export (SPEC §6.3)', () => {
  it('fetches the whole account with the bearer token and no cookie', async () => {
    let headers: Record<string, string> = {};
    const body = await fetchExport(CONFIG, async (_u, init) => {
      headers = init?.headers as Record<string, string>;
      return json({ workouts: [], settings: null, bodyweight: [], serverTime: 0 });
    });
    expect(headers.Authorization).toBe('Bearer tok');
    expect(headers.Cookie).toBeUndefined();
    expect(body).toMatchObject({ workouts: [] });
  });

  it('a failed export throws; it never returns a partial file', async () => {
    await expect(fetchExport(CONFIG, async () => new Response('{}', { status: 401 }))).rejects.toThrow(/HTTP 401/);
  });
});

describe('syncNow: cardio', () => {
  const server = (body: Record<string, unknown>): typeof fetch => async (url) =>
    String(url).includes('/api/sync/pull')
      ? json({ workouts: [], settings: null, bodyweight: [], serverTime: 9000, ...body })
      : json({ applied: 0, duplicates: 0 });
  const C = { id: 'from-server', start: 4, minutes: 25, type: 'bike' };

  it('applies pulled cardio sessions', async () => {
    const local = createRepo(db);
    await syncNow({ outbox: createOutbox(db), local, state: FRESH, fetch: server({ cardio: [C] }), now: () => 1 });
    expect((await local.listCardio()).map((c) => c.id)).toEqual(['from-server']);
  });

  it('keeps the local copy of a session whose write is still queued', async () => {
    const outbox = createOutbox(db);
    const local = createRepo(db);
    const synced = createSyncedRepo(local, outbox, () => 100);
    await synced.saveCardio({ id: 'from-server', start: 4, minutes: 99, type: 'bike' });
    // the push fails, so the write stays queued while the pull still returns the older server copy
    const failingPush: typeof fetch = async (url) =>
      String(url).includes('/api/sync/push') ? new Response('{}', { status: 500 }) : json({ workouts: [], settings: null, bodyweight: [], cardio: [C], serverTime: 9000 });
    await syncNow({ outbox, local, state: FRESH, fetch: failingPush, now: () => 200 });
    expect((await local.listCardio())[0].minutes).toBe(99);
  });

  it('a server that does not know cardio yet (no field in the pull) is fine', async () => {
    const local = createRepo(db);
    const state = await syncNow({ outbox: createOutbox(db), local, state: FRESH, fetch: server({}), now: () => 1 });
    expect(state.lastError).toBeNull();
    expect(await local.listCardio()).toEqual([]);
  });
});
