import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { openAppDb, type Db } from '../db/idb';
import { createRepo } from './idb-repo';
import { createOutbox, type Outbox } from './outbox';
import { createSyncedRepo } from './synced-repo';
import type { Workout } from '../domain/types';

let db: Db;
let outbox: Outbox;
let n = 0;

beforeEach(async () => {
  db = await openAppDb(`test-synced-${n++}`);
  outbox = createOutbox(db);
});

const W: Workout = { id: 'w1', start: 1, end: 2, entries: [] };

describe('synced repo: every write is saved locally and queued for the server', () => {
  it('saveWorkout saves locally and queues one op keyed by the session id', async () => {
    const local = createRepo(db);
    const repo = createSyncedRepo(local, outbox, () => 500);
    await repo.saveWorkout(W);
    expect((await local.listWorkouts()).map((w) => w.id)).toEqual(['w1']);
    const [item] = await outbox.peek(10_000_000);
    expect(item).toMatchObject({ op: 'saveWorkout', key: 'w1', createdAt: 500 });
  });

  it('saveSettings saves locally and queues one settings op', async () => {
    const local = createRepo(db);
    const repo = createSyncedRepo(local, outbox, () => 600);
    await repo.saveSettings({ daysPerWeek: 3, restSec: 90, owned: [4, 6] });
    expect(await local.getSettings()).toEqual({ daysPerWeek: 3, restSec: 90, owned: [4, 6] });
    const [item] = await outbox.peek(10_000_000);
    expect(item).toMatchObject({ op: 'saveSettings', key: 'settings' });
  });

  it('addBodyweight saves locally and queues one bodyweight op keyed by date', async () => {
    const local = createRepo(db);
    const repo = createSyncedRepo(local, outbox, () => 700);
    await repo.addBodyweight('2026-11-05', 82);
    expect(await local.listBodyweight()).toEqual([{ date: '2026-11-05', kg: 82 }]);
    const [item] = await outbox.peek(10_000_000);
    expect(item).toMatchObject({ op: 'saveBodyweight', key: '2026-11-05', payload: { date: '2026-11-05', kg: 82 } });
  });

  it('reads pass straight through to the local repo', async () => {
    const repo = createSyncedRepo(createRepo(db), outbox, () => 1);
    await repo.saveWorkout(W);
    expect(await repo.listWorkouts()).toHaveLength(1);
    expect(await outbox.count()).toBe(1);
  });
});
