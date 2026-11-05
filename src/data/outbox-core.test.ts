import { describe, it, expect } from 'vitest';
import { backoffMs, dueItems, failItem, type OutboxItem } from './outbox-core';
import { OUTBOX } from '../config/thresholds';

const item = (id: number, over: Partial<OutboxItem> = {}): OutboxItem => ({
  id,
  op: 'saveWorkout',
  payload: { id },
  createdAt: 0,
  attempts: 0,
  lastError: null,
  nextTryAt: 0,
  ...over,
});

describe('outbox-core', () => {
  it('returns due items in FIFO (id) order', () => {
    const due = dueItems([item(3), item(1), item(2)], 0);
    expect(due.map((i) => i.id)).toEqual([1, 2, 3]);
  });

  it('returns nothing when the oldest item is still backing off', () => {
    const due = dueItems([item(1, { nextTryAt: 500 }), item(2)], 100);
    expect(due).toEqual([]);
  });

  it('a backing-off item blocks later writes to the same record (no stale overwrite)', () => {
    // v1 failed and is waiting; v2 must not be pushed ahead of it.
    const v1 = item(1, { nextTryAt: 500, payload: { w: 'v1' } });
    const v2 = item(2, { payload: { w: 'v2' } });
    expect(dueItems([v1, v2], 100).map((i) => i.id)).toEqual([]);
    expect(dueItems([v1, v2], 600).map((i) => i.id)).toEqual([1, 2]);
  });

  it('fail increments attempts, records the error and sets nextTryAt', () => {
    const failed = failItem(item(1), 'HTTP 503', 1_000);
    expect(failed.attempts).toBe(1);
    expect(failed.lastError).toBe('HTTP 503');
    expect(failed.nextTryAt).toBe(1_000 + OUTBOX.backoffBaseMs);
  });

  it('backoff doubles and is capped', () => {
    expect(backoffMs(1)).toBe(OUTBOX.backoffBaseMs);
    expect(backoffMs(2)).toBe(OUTBOX.backoffBaseMs * 2);
    expect(backoffMs(3)).toBe(OUTBOX.backoffBaseMs * 4);
    expect(backoffMs(100)).toBe(OUTBOX.backoffCapMs);
  });

  it('a failed item is kept, never dropped', () => {
    const failed = failItem(item(7), 'offline', 0);
    expect(failed.id).toBe(7);
    expect(failed.op).toBe('saveWorkout');
  });
});
