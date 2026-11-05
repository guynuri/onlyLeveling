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
  const stored = withLatestConfig(after, await loadSyncState(db));
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
