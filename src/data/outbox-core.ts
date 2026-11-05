// Pure outbox logic. No IndexedDB here; the adapter in outbox.ts persists these records.
import { OUTBOX } from '../config/thresholds';

export interface OutboxItem {
  id: number;
  op: string;
  payload: unknown;
  createdAt: number;
  attempts: number;
  lastError: string | null;
  nextTryAt: number;
}

export function backoffMs(attempts: number): number {
  // attempts = failures so far (>= 1 after the first failure).
  const exp = OUTBOX.backoffBaseMs * 2 ** Math.max(0, attempts - 1);
  return Math.min(exp, OUTBOX.backoffCapMs);
}

export function failItem(item: OutboxItem, error: string, now: number): OutboxItem {
  const attempts = item.attempts + 1;
  return { ...item, attempts, lastError: error, nextTryAt: now + backoffMs(attempts) };
}

// FIFO by id (ids are increasing). Only items whose nextTryAt has passed are due.
export function dueItems(items: OutboxItem[], now: number): OutboxItem[] {
  return items
    .filter((i) => i.nextTryAt <= now)
    .sort((a, b) => a.id - b.id);
}
