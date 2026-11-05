import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { openAppDb, type Db } from '../db/idb';
import { createOutbox, type Outbox } from './outbox';
import { pushDue, toOp, type SyncConfig } from './sync-client';

let db: Db;
let ob: Outbox;
let n = 0;

beforeEach(async () => {
  db = await openAppDb(`test-sync-${n++}`);
  ob = createOutbox(db);
});

const cfg = (fetchImpl: typeof fetch): SyncConfig => ({
  baseUrl: 'https://api.example',
  token: 'tok',
  fetch: fetchImpl,
});

const ok = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });

describe('toOp', () => {
  it('maps an outbox row to a server op with a stable id and the local write time', () => {
    const op = toOp({
      id: 7,
      op: 'saveWorkout',
      key: null,
      payload: { id: 'w1', start: 1, end: 2, entries: [] },
      createdAt: 123,
      attempts: 0,
      lastError: null,
      nextTryAt: 0,
    });
    expect(op).toEqual({ opId: 'op-7-123', kind: 'workout', data: { id: 'w1', start: 1, end: 2, entries: [] }, updatedAt: 123 });
  });

  it('refuses an op it does not know, so the row stays in the outbox', () => {
    expect(() =>
      toOp({ id: 1, op: 'dropEverything', key: null, payload: {}, createdAt: 1, attempts: 0, lastError: null, nextTryAt: 0 }),
    ).toThrow(/unknown op/);
  });
});

describe('pushDue', () => {
  it('a successful push acks every item it sent', async () => {
    await ob.enqueue('saveWorkout', { id: 'w1', start: 1, end: 2, entries: [] }, 0);
    await ob.enqueue('saveWorkout', { id: 'w2', start: 3, end: 4, entries: [] }, 0);
    const calls: unknown[] = [];
    const result = await pushDue(ob, cfg(async (_u, init) => {
      calls.push(JSON.parse(String(init?.body)));
      return ok({ applied: 2, duplicates: 0 });
    }), 0);
    expect(result).toEqual({ pushed: 2, failed: 0 });
    expect(await ob.count()).toBe(0);
    expect((calls[0] as { ops: unknown[] }).ops).toHaveLength(2);
  });

  it('sends the bearer token in the Authorization header, never a cookie', async () => {
    await ob.enqueue('saveWorkout', { id: 'w1', start: 1, end: 2, entries: [] }, 0);
    let headers: Record<string, string> = {};
    await pushDue(ob, cfg(async (_u, init) => {
      headers = init?.headers as Record<string, string>;
      return ok({ applied: 1, duplicates: 0 });
    }), 0);
    expect(headers.Authorization).toBe('Bearer tok');
    expect(headers.Cookie).toBeUndefined();
  });

  it('a network failure keeps every item in the outbox with its error, never drops it', async () => {
    await ob.enqueue('saveWorkout', { id: 'w1', start: 1, end: 2, entries: [] }, 0);
    const result = await pushDue(ob, cfg(async () => {
      throw new TypeError('Failed to fetch');
    }), 0);
    expect(result).toEqual({ pushed: 0, failed: 1, error: 'Failed to fetch' });
    expect(await ob.count()).toBe(1);
    const [item] = await ob.peek(10_000_000);
    expect(item.lastError).toBe('Failed to fetch');
    expect(item.attempts).toBe(1);
  });

  it('a server error (non-2xx) is a failure too, and nothing is acked', async () => {
    await ob.enqueue('saveWorkout', { id: 'w1', start: 1, end: 2, entries: [] }, 0);
    const result = await pushDue(ob, cfg(async () => new Response('{"error":"server error"}', { status: 500 })), 0);
    expect(result.failed).toBe(1);
    expect(await ob.count()).toBe(1);
  });

  it('nothing due means no request is sent', async () => {
    let called = false;
    const result = await pushDue(ob, cfg(async () => {
      called = true;
      return ok({});
    }), 0);
    expect(result).toEqual({ pushed: 0, failed: 0 });
    expect(called).toBe(false);
  });
});
