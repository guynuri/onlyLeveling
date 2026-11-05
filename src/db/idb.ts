// IndexedDB schema v1 (Phase 1): meta and outbox only. Phase 3 bumps to v2 (PLAN §3.3).
import { openDB, type IDBPDatabase } from 'idb';

export const DB_NAME = 'onlyleveling';
export const DB_VERSION = 1;

export type Db = IDBPDatabase;

export function openAppDb(name: string = DB_NAME): Promise<Db> {
  return openDB(name, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta');
      if (!db.objectStoreNames.contains('outbox')) {
        db.createObjectStore('outbox', { keyPath: 'id', autoIncrement: true });
      }
    },
  });
}
