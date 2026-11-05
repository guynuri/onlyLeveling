// Outbox API over IndexedDB. Pure rules live in outbox-core.ts.
import type { Db } from '../db/idb';
import { dueItems, failItem, type OutboxItem } from './outbox-core';

export type { OutboxItem } from './outbox-core';

export interface Outbox {
  enqueue(op: string, payload: unknown, now?: number): Promise<number>;
  peek(now?: number): Promise<OutboxItem[]>;
  ack(id: number): Promise<void>;
  fail(id: number, error: string, now?: number): Promise<void>;
  count(): Promise<number>;
}

export function createOutbox(db: Db): Outbox {
  return {
    async enqueue(op, payload, now = Date.now()) {
      const id = (await db.add('outbox', {
        op,
        payload,
        createdAt: now,
        attempts: 0,
        lastError: null,
        nextTryAt: now,
      } as Omit<OutboxItem, 'id'>)) as number;
      return id;
    },
    async peek(now = Date.now()) {
      const all = (await db.getAll('outbox')) as OutboxItem[];
      return dueItems(all, now);
    },
    async ack(id) {
      await db.delete('outbox', id);
    },
    async fail(id, error, now = Date.now()) {
      const item = (await db.get('outbox', id)) as OutboxItem | undefined;
      if (!item) return;
      await db.put('outbox', failItem(item, error, now));
    },
    async count() {
      return db.count('outbox');
    },
  };
}
