// Pure outbox logic. No IndexedDB here; the adapter in outbox.ts persists these records.
import { OUTBOX } from '../config/thresholds';

export interface OutboxItem {
  id: number;
  op: string;
  // Record key (e.g. workout id). Writes with the same key are ordered; null = independent.
  key: string | null;
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

// FIFO by id, per record. Items with the same key are ordered: at most one per key is released,
// and only when it is due, so a later write to a record never goes out ahead of an earlier one.
// Items with a different key (or no key) are independent: one record's failure cannot block another.
export function dueItems(items: OutboxItem[], now: number): OutboxItem[] {
  const sorted = [...items].sort((a, b) => a.id - b.id);
  const out: OutboxItem[] = [];
  const held = new Set<string>();
  for (const item of sorted) {
    if (item.key !== null) {
      if (held.has(item.key)) continue;
      held.add(item.key);
    }
    if (item.nextTryAt <= now) out.push(item);
  }
  return out;
}
