// Sync engine (PLAN Phase 4): push the outbox, then pull what changed on the server since the last pull.
// The server's clock is the cursor (server_at), never the phone's. A failure never clears what was last synced.
import type { Db } from '../db/idb';
import type { Repo } from './repo';
import type { Outbox } from './outbox';
import { pushDue } from './sync-client';
import { signOutRequest } from './auth-client';
import type { BodyweightEntry, Settings, Workout } from '../domain/types';
import type { Plan } from '../domain/plan';
import type { Suggestion } from '../domain/suggestion';
import type { CardioSession } from '../domain/cardio';

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
  // Tokens signed out on this device whose server revoke did not go through yet. Retried on the next sync.
  pendingRevoke: string[];
}

const EMPTY: SyncState = { config: null, lastSyncedAt: null, cursor: 0, lastError: null, pendingRevoke: [] };

export async function loadSyncState(db: Db): Promise<SyncState> {
  const stored = (await db.get('meta', 'sync')) as Partial<SyncState> | undefined;
  return { ...EMPTY, ...(stored ?? {}) };
}

export async function saveSyncState(db: Db, state: SyncState): Promise<void> {
  await db.put('meta', state, 'sync');
}

// A sync that was already running must not write back the config it started with: a sign-out or a new
// sign-in during the sync wins. The results of the sync (cursor, last sync, error) are kept.
export function withLatestConfig(after: SyncState, latest: SyncState): SyncState {
  return { ...after, config: latest.config };
}

// A 401 means the server has ended this session (expired, recovered, or signed out elsewhere). The device
// forgets the token and asks for sign-in again. Anything else is a normal error that keeps the session.
function sessionOrError(state: SyncState, error: string): SyncState {
  if (error === 'HTTP 401') {
    return { ...state, config: null, lastError: 'Your session has ended. Sign in again.' };
  }
  return { ...state, lastError: error };
}

interface PullBody {
  workouts: Workout[];
  settings: Settings | null;
  bodyweight: BodyweightEntry[];
  plan?: Plan | null;
  suggestions?: Suggestion[];
  badges?: { badgeKey: string; earnedAt: number }[];
  cardio?: CardioSession[]; // absent from a Worker that does not know cardio yet
  serverTime: number;
}

export async function syncNow(args: {
  outbox: Outbox;
  local: Repo; // the raw local repo: applying server data must not re-queue it
  state: SyncState;
  fetch: typeof fetch;
  now: () => number;
}): Promise<SyncState> {
  const { outbox, local, now } = args;
  if (!args.state.config) return { ...args.state, lastError: 'Not signed in to a server.' };
  const cfg = { ...args.state.config, fetch: args.fetch };

  // Sign-outs that could not reach the server before are retried first.
  let state: SyncState = args.state;
  const stillPending: string[] = [];
  for (const token of state.pendingRevoke) {
    try {
      await signOutRequest({ baseUrl: cfg.baseUrl, fetch: args.fetch }, token);
    } catch {
      stillPending.push(token);
    }
  }
  state = { ...state, pendingRevoke: stillPending };

  const pushed = await pushDue(outbox, cfg, now());
  if (pushed.error) return sessionOrError(state, pushed.error);

  let body: PullBody;
  try {
    const res = await cfg.fetch(`${cfg.baseUrl}/api/sync/pull?since=${state.cursor}`, {
      headers: { Authorization: `Bearer ${cfg.token}` },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    body = (await res.json()) as PullBody;
  } catch (e) {
    return sessionOrError(state, e instanceof Error ? e.message : 'sync failed');
  }

  // A record with a write still queued keeps the local copy: the server's copy is older, and the queued write
  // will reach the server on a later push. Other records are applied as usual.
  const pending = await outbox.pendingKeys();
  for (const w of body.workouts) {
    if (!pending.has(w.id)) await local.saveWorkout(w);
  }
  for (const c of body.cardio ?? []) {
    if (!pending.has(c.id)) await local.saveCardio(c);
  }
  if (body.settings && !pending.has('settings')) await local.saveSettings(body.settings);
  for (const b of body.bodyweight) {
    if (!pending.has(b.date)) await local.addBodyweight(b.date, b.kg);
  }
  if (body.plan && !pending.has('plan')) await local.savePlan(body.plan);
  for (const s of body.suggestions ?? []) {
    if (!pending.has(s.id)) await local.saveSuggestion(s);
  }
  for (const b of body.badges ?? []) await local.awardBadge(b.badgeKey, b.earnedAt);

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
