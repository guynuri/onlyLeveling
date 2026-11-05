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
const KIND: Record<string, 'workout' | 'settings' | 'bodyweight'> = {
  saveWorkout: 'workout',
  saveSettings: 'settings',
  saveBodyweight: 'bodyweight',
};

// Server op for one outbox row. The op id is stable for the row, so a retry is a duplicate, not a second write.
export function toOp(item: OutboxItem): {
  opId: string;
  kind: 'workout' | 'settings' | 'bodyweight';
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

  try {
    const res = await cfg.fetch(`${cfg.baseUrl}/api/sync/push`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cfg.token}` },
      body: JSON.stringify({ ops }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    for (const item of due) await outbox.ack(item.id);
    return { pushed: due.length, failed: 0 };
  } catch (e) {
    const message = e instanceof Error ? e.message : 'sync failed';
    for (const item of due) await outbox.fail(item.id, message, now);
    return { pushed: 0, failed: due.length, error: message };
  }
}
