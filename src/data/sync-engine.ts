// Sync engine (PLAN Phase 4): push the outbox, then pull what changed on the server since the last pull.
// The server's clock is the cursor (server_at), never the phone's. A failure never clears what was last synced.
import type { Db } from '../db/idb';
import type { Repo } from './repo';
import type { Outbox } from './outbox';
import { pushDue } from './sync-client';
import type { BodyweightEntry, Settings, Workout } from '../domain/types';

// What is stored: address and token only. A fetch function cannot be stored, so it is added at sync time.
export interface ServerConfig {
  baseUrl: string;
  token: string;
}

export interface SyncState {
  config: ServerConfig | null; // holds the bearer token; stored on this device only (CLAUDE.md)
  lastSyncedAt: number | null; // local time of the last fully successful sync
  cursor: number; // server time of the last pull
  lastError: string | null;
}

const EMPTY: SyncState = { config: null, lastSyncedAt: null, cursor: 0, lastError: null };

export async function loadSyncState(db: Db): Promise<SyncState> {
  return ((await db.get('meta', 'sync')) as SyncState | undefined) ?? { ...EMPTY };
}

export async function saveSyncState(db: Db, state: SyncState): Promise<void> {
  await db.put('meta', state, 'sync');
}

interface PullBody {
  workouts: Workout[];
  settings: Settings | null;
  bodyweight: BodyweightEntry[];
  serverTime: number;
}

export async function syncNow(args: {
  outbox: Outbox;
  local: Repo; // the raw local repo: applying server data must not re-queue it
  state: SyncState;
  fetch: typeof fetch;
  now: () => number;
}): Promise<SyncState> {
  const { outbox, local, state, now } = args;
  if (!state.config) return { ...state, lastError: 'Not signed in to a server.' };
  const cfg = { ...state.config, fetch: args.fetch };

  const pushed = await pushDue(outbox, cfg, now());
  if (pushed.error) return { ...state, lastError: pushed.error };

  let body: PullBody;
  try {
    const res = await cfg.fetch(`${cfg.baseUrl}/api/sync/pull?since=${state.cursor}`, {
      headers: { Authorization: `Bearer ${cfg.token}` },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    body = (await res.json()) as PullBody;
  } catch (e) {
    return { ...state, lastError: e instanceof Error ? e.message : 'sync failed' };
  }

  for (const w of body.workouts) await local.saveWorkout(w);
  if (body.settings) await local.saveSettings(body.settings);
  for (const b of body.bodyweight) await local.addBodyweight(b.date, b.kg);

  return { ...state, cursor: body.serverTime, lastSyncedAt: now(), lastError: null };
}

// The whole account as JSON (SPEC §6.3). Throws on any failure, so a partial file is never returned.
export async function fetchExport(cfg: ServerConfig, fetchImpl: typeof fetch = fetch): Promise<unknown> {
  const res = await fetchImpl(`${cfg.baseUrl}/api/export`, {
    headers: { Authorization: `Bearer ${cfg.token}` },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}
