// Client side of sync (PLAN Phase 4): flush due outbox items to the Worker. Local writes are already saved;
// an item leaves the outbox only after the server accepted it. Nothing is dropped on failure.
import type { Outbox, OutboxItem } from './outbox';

export interface SyncConfig {
  baseUrl: string; // e.g. https://<worker>.workers.dev
  token: string; // bearer token; never a cookie (CLAUDE.md)
  fetch: typeof fetch;
}

export interface PushResult {
  pushed: number;
  failed: number;
  error?: string;
}

// The outbox op names the app writes, mapped to the server's op kinds.
type Kind = 'workout' | 'settings' | 'bodyweight' | 'plan' | 'suggestion' | 'badge';
const KIND: Record<string, Kind> = {
  saveWorkout: 'workout',
  saveSettings: 'settings',
  saveBodyweight: 'bodyweight',
  savePlan: 'plan',
  saveSuggestion: 'suggestion',
  awardBadge: 'badge',
};

// Server op for one outbox row. The op id is stable for the row, so a retry is a duplicate, not a second write.
export function toOp(item: OutboxItem): {
  opId: string;
  kind: Kind;
  data: unknown;
  updatedAt: number;
} {
  const kind = KIND[item.op];
  if (!kind) throw new Error(`unknown op: ${item.op}`);
  return { opId: `op-${item.id}-${item.createdAt}`, kind, data: item.payload, updatedAt: item.createdAt };
}

export async function pushDue(outbox: Outbox, cfg: SyncConfig, now: number): Promise<PushResult> {
  const due = await outbox.peek(now);
  if (due.length === 0) return { pushed: 0, failed: 0 };

  let ops: ReturnType<typeof toOp>[];
  try {
    ops = due.map(toOp);
  } catch (e) {
    // A row this build does not understand stays queued; it is reported, not sent or dropped.
    const message = e instanceof Error ? e.message : 'unknown op';
    for (const item of due) await outbox.fail(item.id, message, now);
    return { pushed: 0, failed: due.length, error: message };
  }

  const send = (batch: ReturnType<typeof toOp>[]) =>
    cfg.fetch(`${cfg.baseUrl}/api/sync/push`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cfg.token}` },
      body: JSON.stringify({ ops: batch }),
    });

  try {
    const res = await send(ops);
    if (res.ok) {
      for (const item of due) await outbox.ack(item.id);
      return { pushed: due.length, failed: 0 };
    }
    if (res.status !== 400 || due.length === 1) {
      throw new Error(`HTTP ${res.status}`);
    }
    // The server refused the batch as a whole because one op is invalid. Send each op alone, so the valid ones
    // go through and only the invalid one waits (with its error) instead of stalling every row behind it.
    let pushed = 0;
    let failed = 0;
    let lastError: string | undefined;
    for (let i = 0; i < due.length; i++) {
      const single = await send([ops[i]]);
      if (single.ok) {
        await outbox.ack(due[i].id);
        pushed++;
      } else {
        lastError = `HTTP ${single.status}`;
        await outbox.fail(due[i].id, lastError, now);
        failed++;
      }
    }
    return lastError ? { pushed, failed, error: lastError } : { pushed, failed };
  } catch (e) {
    // Network failure: nothing is acked, every row keeps its error and retries with backoff.
    const message = e instanceof Error ? e.message : 'sync failed';
    for (const item of due) await outbox.fail(item.id, message, now);
    return { pushed: 0, failed: due.length, error: message };
  }
}
