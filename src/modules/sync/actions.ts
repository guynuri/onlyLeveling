// Sync and account actions for the UI. Every action that changes the account stores the session token on this
// device, then syncs. Nothing here throws to the caller except the auth errors the screen shows.
import { getDb, getLocalRepo, getOutbox } from '../training/data';
import { loadSyncState, saveSyncState, syncNow, withLatestConfig, type ServerConfig, type SyncState } from '../../data/sync-engine';
import {
  signInRequest,
  signUpRequest,
  recoverRequest,
  signOutRequest,
  createInviteRequest,
  type AuthClientOptions,
} from '../../data/auth-client';

export const SYNC_EVENT = 'onlyleveling:sync-state';
type FetchFn = typeof fetch;
const defaultFetch: FetchFn = (...args) => fetch(...args);

function announce(): void {
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(SYNC_EVENT));
}

export async function readSyncState(): Promise<SyncState> {
  return loadSyncState(await getDb());
}

// Run one sync and store the result. Never throws: a failure is reported in the returned state.
export async function runSync(fetchImpl: FetchFn = defaultFetch): Promise<SyncState> {
  const db = await getDb();
  const before = await loadSyncState(db);
  let after: SyncState;
  try {
    after = await syncNow({
      outbox: await getOutbox(),
      local: await getLocalRepo(),
      state: before,
      fetch: fetchImpl,
      now: () => Date.now(),
    });
  } catch (e) {
    after = { ...before, lastError: e instanceof Error ? e.message : 'sync failed' };
  }
  const stored = withLatestConfig(after, await loadSyncState(db), before);
  await saveSyncState(db, stored);
  announce();
  return stored;
}

function normalise(baseUrl: string): string {
  return baseUrl.trim().replace(/\/+$/, '');
}

// Store the session for this server, then sync. Used after sign-in, sign-up and recovery.
async function adopt(baseUrl: string, token: string, fetchImpl: FetchFn): Promise<SyncState> {
  const db = await getDb();
  const cfg: ServerConfig = { baseUrl: normalise(baseUrl), token };
  await saveSyncState(db, { ...(await loadSyncState(db)), config: cfg, lastError: null });
  return runSync(fetchImpl);
}

export async function signInWithPassword(
  baseUrl: string,
  username: string,
  password: string,
  fetchImpl: FetchFn = defaultFetch,
): Promise<SyncState> {
  const { token } = await signInRequest(authOpts(baseUrl, fetchImpl), { username, password });
  return adopt(baseUrl, token, fetchImpl);
}

export async function createAccountWithInvite(
  baseUrl: string,
  input: { code: string; username: string; password: string },
  fetchImpl: FetchFn = defaultFetch,
): Promise<SyncState> {
  const { token } = await signUpRequest(authOpts(baseUrl, fetchImpl), input);
  return adopt(baseUrl, token, fetchImpl);
}

export async function recoverAccount(
  baseUrl: string,
  input: { username: string; code: string; newPassword: string },
  fetchImpl: FetchFn = defaultFetch,
): Promise<SyncState> {
  const { token } = await recoverRequest(authOpts(baseUrl, fetchImpl), input);
  return adopt(baseUrl, token, fetchImpl);
}

// Ends the session on the server (best effort) and forgets it on this device. Local data is kept.
export async function signOut(fetchImpl: FetchFn = defaultFetch): Promise<void> {
  const db = await getDb();
  const state = await loadSyncState(db);
  let pendingRevoke = state.pendingRevoke;
  if (state.config) {
    try {
      await signOutRequest(authOpts(state.config.baseUrl, fetchImpl), state.config.token);
    } catch {
      // Offline: the device signs out now, and the token is kept to revoke on the next sync.
      pendingRevoke = [...pendingRevoke, state.config.token];
    }
  }
  await saveSyncState(db, { ...state, config: null, lastError: null, pendingRevoke });
  announce();
}

// Signing out removes this phone's copy (owner decision 2026-11-07: an account is required, and the next account to
// sign in here must not upload the previous one's data). Refuses while changes have not reached the server yet, so
// nothing is lost: the caller says so and offers Sync now. The account keeps everything.
export async function signOutAndClear(fetchImpl: FetchFn = defaultFetch): Promise<'done' | 'unsynced'> {
  await runSync(fetchImpl).catch(() => undefined);
  if ((await (await getOutbox()).pendingKeys()).size > 0) return 'unsynced';
  await signOut(fetchImpl);
  const db = await getDb();
  for (const store of ['settings', 'plans', 'workouts', 'bodyweight', 'suggestions', 'badges', 'aiCache', 'cardio', 'game', 'outbox'] as const) {
    await db.clear(store);
  }
  await db.delete('meta', 'liveSession'); // a workout in progress belonged to that account
  const st = await loadSyncState(db);
  await saveSyncState(db, { ...st, cursor: 0, lastSyncedAt: null, lastError: null }); // the next account pulls everything
  try {
    localStorage.removeItem('muscleRanks');
  } catch {
    // derived data: fine to keep
  }
  announce();
  return 'done';
}

// A new invite code for this account. Shown once; the server keeps only its hash.
export async function createInvite(fetchImpl: FetchFn = defaultFetch): Promise<string> {
  const state = await loadSyncState(await getDb());
  if (!state.config) throw new Error('Sign in to create an invite code.');
  const { code } = await createInviteRequest(authOpts(state.config.baseUrl, fetchImpl), state.config.token);
  return code;
}

function authOpts(baseUrl: string, fetchImpl: FetchFn): AuthClientOptions {
  return { baseUrl: normalise(baseUrl), fetch: fetchImpl };
}

// "last synced" text for the top bar.
export function syncLabel(state: SyncState): string {
  if (!state.config) return 'local only';
  if (state.lastError) return `sync failed: ${state.lastError}`;
  if (state.lastSyncedAt === null) return 'last synced: not yet';
  return `last synced: ${new Date(state.lastSyncedAt).toLocaleString()}`;
}
