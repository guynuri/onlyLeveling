// Sync actions for the UI: run a sync, and tell the rest of the app the state changed.
import { getDb, getLocalRepo, getOutbox } from '../training/data';
import {
  loadSyncState,
  saveSyncState,
  syncNow,
  withLatestConfig,
  type ServerConfig,
  type SyncState,
} from '../../data/sync-engine';

export const SYNC_EVENT = 'onlyleveling:sync-state';

export async function readSyncState(): Promise<SyncState> {
  return loadSyncState(await getDb());
}

// Run one sync and store the result. Never throws: a failure (for example a local write that fails while
// applying pulled data) is reported in the returned state, so the buttons always settle.
export async function runSync(): Promise<SyncState> {
  const db = await getDb();
  const before = await loadSyncState(db);
  let after: SyncState;
  try {
    after = await syncNow({
      outbox: await getOutbox(),
      local: await getLocalRepo(),
      state: before,
      fetch: (...args) => fetch(...args),
      now: () => Date.now(),
    });
  } catch (e) {
    after = { ...before, lastError: e instanceof Error ? e.message : 'sync failed' };
  }
  const stored = withLatestConfig(after, await loadSyncState(db));
  await saveSyncState(db, stored);
  window.dispatchEvent(new CustomEvent(SYNC_EVENT));
  return stored;
}

// Store the server address and token, then sync now.
export async function signIn(baseUrl: string, token: string): Promise<SyncState> {
  const db = await getDb();
  const cfg: ServerConfig = { baseUrl: baseUrl.replace(/\/+$/, ''), token };
  await saveSyncState(db, { ...(await loadSyncState(db)), config: cfg, lastError: null });
  return runSync();
}

// Forget the server and the token on this device. Local data stays.
export async function signOut(): Promise<void> {
  const db = await getDb();
  await saveSyncState(db, { ...(await loadSyncState(db)), config: null, lastError: null });
  window.dispatchEvent(new CustomEvent(SYNC_EVENT));
}

// "last synced" text for the top bar.
export function syncLabel(state: SyncState): string {
  if (!state.config) return 'local only';
  if (state.lastError) return `sync failed: ${state.lastError}`;
  if (state.lastSyncedAt === null) return 'last synced: not yet';
  return `last synced: ${new Date(state.lastSyncedAt).toLocaleString()}`;
}
