import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { openAppDb, type Db } from '../db/idb';
import { createRepo } from './idb-repo';
import { createOutbox } from './outbox';
import { createSyncedRepo } from './synced-repo';
import { syncNow, loadSyncState, saveSyncState, fetchExport, type SyncState } from './sync-engine';

let db: Db;
let n = 0;

beforeEach(async () => {
  db = await openAppDb(`test-engine-${n++}`);
});

const CONFIG = { baseUrl: 'https://api.example', token: 'tok' };
const FRESH: SyncState = { config: CONFIG, lastSyncedAt: null, cursor: 0, lastError: null };

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

describe('sync state storage', () => {
  it('round-trips the config and cursor through the meta store', async () => {
    expect(await loadSyncState(db)).toEqual({ config: null, lastSyncedAt: null, cursor: 0, lastError: null });
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
