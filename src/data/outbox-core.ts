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

// FIFO by id. Returns the due prefix of the queue: stops at the first item still backing off,
// so a later write to the same record can never be pushed ahead of an earlier, failed one.
export function dueItems(items: OutboxItem[], now: number): OutboxItem[] {
  const sorted = [...items].sort((a, b) => a.id - b.id);
  const out: OutboxItem[] = [];
  for (const item of sorted) {
    if (item.nextTryAt > now) break;
    out.push(item);
  }
  return out;
}
