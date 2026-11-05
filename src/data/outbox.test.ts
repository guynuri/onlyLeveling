import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { openAppDb, type Db } from '../db/idb';
import { createOutbox } from './outbox';

let db: Db;
let n = 0;

beforeEach(async () => {
  db = await openAppDb(`test-outbox-${n++}`);
});

describe('outbox (IndexedDB adapter)', () => {
  it('is FIFO and ack removes only that item', async () => {
    const ob = createOutbox(db);
    const a = await ob.enqueue('saveWorkout', { w: 1 }, 0);
    const b = await ob.enqueue('saveWorkout', { w: 2 }, 0);
    expect((await ob.peek(0)).map((i) => i.id)).toEqual([a, b]);
    await ob.ack(a);
    expect((await ob.peek(0)).map((i) => i.id)).toEqual([b]);
  });

  it('acking the head of a record releases its next write', async () => {
    const ob = createOutbox(db);
    const v1 = await ob.enqueue('saveWorkout', { w: 'v1' }, 0, 'w1');
    const v2 = await ob.enqueue('saveWorkout', { w: 'v2' }, 0, 'w1');
    expect((await ob.peek(0)).map((i) => i.id)).toEqual([v1]);
    await ob.ack(v1);
    expect((await ob.peek(0)).map((i) => i.id)).toEqual([v2]);
  });

  it('a fail racing an ack never resurrects the acked item', async () => {
    const ob = createOutbox(db);
    const id = await ob.enqueue('saveWorkout', {}, 0);
    await Promise.all([ob.fail(id, 'offline', 0), ob.ack(id)]);
    expect(await ob.count()).toBe(0);
  });

  it('fail keeps the item, bumps attempts and delays the next try', async () => {
    const ob = createOutbox(db);
    const id = await ob.enqueue('saveWorkout', {}, 0);
    await ob.fail(id, 'offline', 0);
    expect(await ob.peek(0)).toHaveLength(0);
    const later = await ob.peek(10_000_000);
    expect(later[0]).toMatchObject({ id, attempts: 1, lastError: 'offline' });
    expect(await ob.count()).toBe(1);
  });
});
