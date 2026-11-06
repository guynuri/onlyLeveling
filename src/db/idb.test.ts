import 'fake-indexeddb/auto';
import { describe, it, expect } from 'vitest';
import { openDB } from 'idb';
import { openAppDb, DB_VERSION } from './idb';

let n = 0;
const fresh = () => `test-idb-${n++}`;

describe('IndexedDB schema v2', () => {
  it('when a newer version is requested, the old connection is closed and the app is told', async () => {
    const name = fresh();
    let told = 0;
    const app = await openAppDb(name, { onVersionChange: () => told++ });
    const newer = await openDB(name, DB_VERSION + 1, {
      upgrade() {},
      blocked() {},
    });
    await new Promise((r) => setTimeout(r, 50));
    expect(told).toBe(1);
    await expect(app.count('outbox')).rejects.toThrow();
    newer.close();
  });

  it('opens at the current version with every store PLAN §3.3 lists, and the cardio store (U5b)', async () => {
    const db = await openAppDb(fresh());
    expect(db.version).toBe(DB_VERSION);
    expect([...db.objectStoreNames].sort()).toEqual(
      ['aiCache', 'badges', 'bodyweight', 'cardio', 'meta', 'outbox', 'plans', 'settings', 'suggestions', 'workouts'].sort(),
    );
    db.close();
  });

  it('upgrades an existing v1 database without losing its outbox', async () => {
    const name = fresh();
    const v1 = await openDB(name, 1, {
      upgrade(db) {
        db.createObjectStore('meta');
        db.createObjectStore('outbox', { keyPath: 'id', autoIncrement: true });
      },
    });
    await v1.add('outbox', { id: 0, op: 'saveWorkout' } as never);
    v1.close();

    const v2 = await openAppDb(name);
    expect(await v2.count('outbox')).toBe(1);
    expect(v2.objectStoreNames.contains('workouts')).toBe(true);
    v2.close();
  });

  it('reports blocked while an older connection holds the database, then completes once it closes', async () => {
    const name = fresh();
    const older = await openDB(name, 1, {
      upgrade(db) {
        db.createObjectStore('meta');
      },
    });
    let blocked = 0;
    const pending = openAppDb(name, { onBlocked: () => blocked++ });
    await new Promise((r) => setTimeout(r, 50));
    expect(blocked).toBeGreaterThan(0);
    older.close();
    const db = await pending;
    expect(db.version).toBe(DB_VERSION);
    db.close();
  });
});
