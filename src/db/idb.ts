// IndexedDB schema. v1: meta, outbox (Phase 1). v2: training stores and reserved empty stores (PLAN §3.3).
import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { OutboxItem } from '../data/outbox-core';

export const DB_NAME = 'onlyleveling';
export const DB_VERSION = 2;

export interface AppSchema extends DBSchema {
  meta: { key: string; value: unknown };
  // autoIncrement key; the stored value carries its id (keyPath 'id'). Added via `as OutboxItem` in outbox.ts.
  outbox: { key: number; value: OutboxItem };
  settings: { key: string; value: unknown }; // single record, key 'settings'
  plans: { key: string; value: unknown };
  workouts: { key: string; value: unknown };
  bodyweight: { key: string; value: unknown }; // { date, kg }
  // Reserved in v2 so later phases need no version bump (PLAN §3.3).
  suggestions: { key: string; value: unknown }; // Phase 5
  badges: { key: string; value: unknown }; // Phase 6
  aiCache: { key: string; value: unknown }; // Phase 7
}

export type Db = IDBPDatabase<AppSchema>;

export interface OpenOptions {
  // Another tab still holds an older version, so the upgrade is waiting. Show a message in the UI (Phase 4).
  onBlocked?: () => void;
  // A newer version was requested (another tab upgraded). This connection is closed; the app must reopen
  // or tell the user to reload. Calls on the closed handle throw, so the caller must not keep using it.
  onVersionChange?: () => void;
}

export function openAppDb(name: string = DB_NAME, opts: OpenOptions = {}): Promise<Db> {
  let handle: Db | undefined;
  return openDB<AppSchema>(name, DB_VERSION, {
    upgrade(db, oldVersion) {
      if (oldVersion < 1) {
        db.createObjectStore('meta');
        db.createObjectStore('outbox', { keyPath: 'id', autoIncrement: true });
      }
      if (oldVersion < 2) {
        for (const store of ['settings', 'plans', 'workouts', 'bodyweight', 'suggestions', 'badges', 'aiCache'] as const) {
          db.createObjectStore(store);
        }
      }
    },
    blocked() {
      opts.onBlocked?.();
    },
    blocking() {
      // Release our connection so the newer version can open, then tell the app its handle is dead.
      handle?.close();
      opts.onVersionChange?.();
    },
  }).then((db) => {
    handle = db;
    return db;
  });
}
