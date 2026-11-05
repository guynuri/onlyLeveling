// The cron job (every minute): send due rest alerts and workout reminders (PLAN Phase 9). Looks at D1 only.
// A device whose subscription is gone (404 or 410) is removed. Anything else is kept for the next run.
import { sendPush, type PushSub, type VapidConfig } from './webpush';
import { localParts, reminderDue, sessionsThisWeek, shouldRemind, validTimeZone } from './schedule';
import { PUSH } from '../config';

export interface Message {
  kind: 'rest' | 'reminder';
  title: string;
  body: string;
}

const DAY_MS = 86_400_000;

export interface RunResult {
  sent: number;
  removed: number;
}

// The VAPID keys from the environment: the public key is a var, the private key a secret (JWK JSON).
// Missing or unreadable → null, and nothing is sent.
export function vapidFromEnv(env: { VAPID_PUBLIC?: string; VAPID_PRIVATE_JWK?: string }): VapidConfig | null {
  if (!env.VAPID_PUBLIC || !env.VAPID_PRIVATE_JWK) return null;
  try {
    return { publicKey: env.VAPID_PUBLIC, privateJwk: JSON.parse(env.VAPID_PRIVATE_JWK) as JsonWebKey, subject: PUSH.vapidSubject };
  } catch {
    return null;
  }
}

export async function runDue(db: D1Database, vapid: VapidConfig | null, now: number): Promise<RunResult> {
  const result: RunResult = { sent: 0, removed: 0 };
  // Not configured: nothing is sent. The app shows that push is off, so this never fails silently.
  if (!vapid) return result;

  const rests = await db
    .prepare('SELECT user_id, fire_at FROM rest_alerts WHERE fire_at <= ?')
    .bind(now)
    .all<{ user_id: string; fire_at: number }>();
  for (const row of rests.results) {
    await db.prepare('DELETE FROM rest_alerts WHERE user_id = ?').bind(row.user_id).run();
    // A rest alert that is late by more than the limit is dropped: a "rest is over" minutes later is noise.
    if (now - row.fire_at > PUSH.restStaleMs) continue;
    add(result, await notify(db, row.user_id, { kind: 'rest', title: 'Rest is over', body: 'Time for your next set.' }, vapid, now));
  }

  const reminders = await db
    .prepare('SELECT user_id, time, tz, last_sent_day FROM reminders WHERE enabled = 1')
    .all<{ user_id: string; time: string; tz: string; last_sent_day: string | null }>();
  for (const r of reminders.results) {
    if (!validTimeZone(r.tz) || !reminderDue({ time: r.time, tz: r.tz, lastSentDay: r.last_sent_day }, now)) continue;
    // Once per local day, whatever happens next: a reminder is not repeated by a retry.
    await db
      .prepare('UPDATE reminders SET last_sent_day = ? WHERE user_id = ?')
      .bind(localParts(now, r.tz).day, r.user_id)
      .run();
    const daysPerWeek = await plannedDays(db, r.user_id);
    if (daysPerWeek === null) continue;
    const starts = await recentStarts(db, r.user_id, now);
    if (!shouldRemind(sessionsThisWeek(starts, r.tz, now), daysPerWeek)) continue;
    add(result, await notify(db, r.user_id, { kind: 'reminder', title: 'Time to train', body: 'Today is a planned session.' }, vapid, now));
  }
  return result;
}

function add(total: RunResult, part: RunResult): void {
  total.sent += part.sent;
  total.removed += part.removed;
}

async function plannedDays(db: D1Database, userId: string): Promise<number | null> {
  const row = await db.prepare('SELECT data FROM settings WHERE user_id = ?').bind(userId).first<{ data: string }>();
  if (!row) return null;
  const days = (JSON.parse(row.data) as { daysPerWeek?: unknown }).daysPerWeek;
  return typeof days === 'number' && days > 0 ? days : null;
}

// Start times of this user's recent sessions. The window is wider than a week, so the Monday-start week is complete.
async function recentStarts(db: D1Database, userId: string, now: number): Promise<number[]> {
  const rows = await db
    .prepare('SELECT data FROM workouts WHERE user_id = ? AND updated_at >= ?')
    .bind(userId, now - 14 * DAY_MS)
    .all<{ data: string }>();
  return rows.results.map((r) => (JSON.parse(r.data) as { start: number }).start);
}

async function notify(db: D1Database, userId: string, message: Message, vapid: VapidConfig, now: number): Promise<RunResult> {
  const out: RunResult = { sent: 0, removed: 0 };
  const subs = await db
    .prepare('SELECT endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = ?')
    .bind(userId)
    .all<PushSub>();
  for (const sub of subs.results) {
    try {
      const status = await sendPush(sub, message, vapid, now);
      if (status === 201 || status === 200) out.sent++;
      else if (status === 404 || status === 410) {
        await db.prepare('DELETE FROM push_subscriptions WHERE user_id = ? AND endpoint = ?').bind(userId, sub.endpoint).run();
        out.removed++;
      }
    } catch {
      // Unreachable push service: keep the subscription and try again on the next run.
    }
  }
  return out;
}
