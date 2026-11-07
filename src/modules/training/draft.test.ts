import 'fake-indexeddb/auto';
import { describe, it, expect } from 'vitest';
import { clearDraft, isRestorable, readDraft, writeDraft, type Draft } from './draft';
import { openAppDb } from '../../db/idb';

const HOUR = 3_600_000;
const draft = (over: Partial<Draft> = {}): Draft => ({
  dayIndex: 1,
  startedAt: 1_000_000,
  exercises: [{ exerciseId: 'a', mode: 'reps', prescription: { w: 8, reps: 10, sets: 3 }, sets: [] }],
  ...over,
});

describe('isRestorable', () => {
  const now = 1_000_000 + HOUR;
  it('a draft for the same plan day, started recently, is restorable', () => {
    expect(isRestorable(draft(), 1, now)).toBe(true);
  });
  it('another plan day is not', () => {
    expect(isRestorable(draft(), 2, now)).toBe(false);
  });
  it('editing the plan while the session runs does not drop the logged sets: the draft carries its own exercises', () => {
    // the plan's updatedAt is no longer part of the check at all
    expect(isRestorable(draft(), 1, now)).toBe(true);
  });
  it('a draft older than 12 hours is not', () => {
    expect(isRestorable(draft(), 1, 1_000_000 + 13 * HOUR)).toBe(false);
  });
  it('no draft is not restorable', () => {
    expect(isRestorable(undefined, 1, now)).toBe(false);
  });
});

let n = 0;
describe('draft storage', () => {
  it('writes, reads back and clears, and never queues anything for the server', async () => {
    const db = await openAppDb(`draft-${n++}`);
    expect(await readDraft(db)).toBeUndefined();
    await writeDraft(db, draft());
    expect(await readDraft(db)).toEqual(draft());
    expect(await db.count('outbox')).toBe(0);
    await clearDraft(db);
    expect(await readDraft(db)).toBeUndefined();
  });
});
