// Sync: push (idempotent per op id, last write wins per record), pull (changed since a time), export.
// Every statement is scoped by user_id (PLAN Phase 4: "every Worker query is scoped by userId").

export const MAX_OPS = 500;

export type Op =
  | { opId: string; kind: 'workout'; data: { id: string } & Record<string, unknown>; updatedAt: number }
  | { opId: string; kind: 'settings'; data: Record<string, unknown>; updatedAt: number }
  | { opId: string; kind: 'bodyweight'; data: { date: string; kg: number }; updatedAt: number }
  | { opId: string; kind: 'plan'; data: Record<string, unknown>; updatedAt: number }
  | { opId: string; kind: 'suggestion'; data: { id: string } & Record<string, unknown>; updatedAt: number }
  | { opId: string; kind: 'badge'; data: { badgeKey: string; earnedAt: number }; updatedAt: number }
  | { opId: string; kind: 'cardio'; data: { id: string } & Record<string, unknown>; updatedAt: number };

export class ValidationError extends Error {}

// Badge keys: session milestones, first PR, first rank-up, and per-muscle ranks from C up (badges.ts, config XP).
const BADGE_KEY =
  /^(session:(1|10|100)|pr:first|rankup:first|muscle:(chest|back|shoulders|biceps|triceps|quads|hamstrings|glutes|calves|core):(C|B|A|S|SS|SSS))$/;

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isStr = (v: unknown): v is string => typeof v === 'string' && v.length > 0 && v.length <= 200;

// Trust boundary: anything the client sends is checked here; unknown kinds are rejected, not guessed.
export function parseOps(body: unknown): Op[] {
  if (!isObj(body) || !Array.isArray(body.ops)) throw new ValidationError('body must be {ops: [...]}');
  if (body.ops.length > MAX_OPS) throw new ValidationError(`too many ops (max ${MAX_OPS})`);
  return body.ops.map((raw, i): Op => {
    if (!isObj(raw) || !isStr(raw.opId) || !isNum(raw.updatedAt)) {
      throw new ValidationError(`op ${i}: needs opId and updatedAt`);
    }
    const common = { opId: raw.opId, updatedAt: raw.updatedAt };
    if (raw.kind === 'workout') {
      if (!isObj(raw.data) || !isStr(raw.data.id)) throw new ValidationError(`op ${i}: workout needs data.id`);
      return { ...common, kind: 'workout', data: raw.data as Op extends { kind: 'workout' } ? Op['data'] : never };
    }
    if (raw.kind === 'settings') {
      if (!isObj(raw.data)) throw new ValidationError(`op ${i}: settings needs data`);
      return { ...common, kind: 'settings', data: raw.data };
    }
    if (raw.kind === 'bodyweight') {
      if (!isObj(raw.data) || !isStr(raw.data.date) || !isNum(raw.data.kg)) {
        throw new ValidationError(`op ${i}: bodyweight needs date and kg`);
      }
      return { ...common, kind: 'bodyweight', data: { date: raw.data.date, kg: raw.data.kg } };
    }
    if (raw.kind === 'plan') {
      if (!isObj(raw.data) || !isNum(raw.data.daysPerWeek)) throw new ValidationError(`op ${i}: plan needs daysPerWeek`);
      return { ...common, kind: 'plan', data: raw.data };
    }
    if (raw.kind === 'suggestion') {
      if (!isObj(raw.data) || !isStr(raw.data.id)) throw new ValidationError(`op ${i}: suggestion needs data.id`);
      return { ...common, kind: 'suggestion', data: raw.data as { id: string } & Record<string, unknown> };
    }
    if (raw.kind === 'badge') {
      if (!isObj(raw.data) || !isStr(raw.data.badgeKey) || !isNum(raw.data.earnedAt)) {
        throw new ValidationError(`op ${i}: badge needs badgeKey and earnedAt`);
      }
      // Only the keys the app produces (src/modules/xp/domain/badges.ts). Anything else is rejected, not stored.
      if (!BADGE_KEY.test(raw.data.badgeKey)) throw new ValidationError(`op ${i}: unknown badge key`);
      return { ...common, kind: 'badge', data: { badgeKey: raw.data.badgeKey, earnedAt: raw.data.earnedAt } };
    }
    if (raw.kind === 'cardio') {
      if (!isObj(raw.data) || !isStr(raw.data.id) || !isStr(raw.data.type) || !isNum(raw.data.minutes) || raw.data.minutes <= 0) {
        throw new ValidationError(`op ${i}: cardio needs id, type and minutes`);
      }
      return { ...common, kind: 'cardio', data: raw.data as { id: string } & Record<string, unknown> };
    }
    throw new ValidationError(`op ${i}: unknown kind`);
  });
}

// Apply ops. Applying first and recording the op id second is safe to retry: re-applying a write with the
// same timestamp changes nothing, while a lost op would be data loss.
export async function applyPush(
  db: D1Database,
  userId: string,
  ops: Op[],
  now: number,
): Promise<{ applied: number; duplicates: number }> {
  let applied = 0;
  let duplicates = 0;
  for (const op of ops) {
    const seen = await db
      .prepare('SELECT 1 AS x FROM ops_applied WHERE user_id = ? AND op_id = ?')
      .bind(userId, op.opId)
      .first();
    if (seen) {
      duplicates++;
      continue;
    }
    await upsert(db, userId, op, now);
    await db
      .prepare('INSERT OR IGNORE INTO ops_applied (user_id, op_id, applied_at) VALUES (?, ?, ?)')
      .bind(userId, op.opId, now)
      .run();
    applied++;
  }
  return { applied, duplicates };
}

// Last write wins on the client's updatedAt. server_at is the server's receive time, and only moves when a
// write is actually applied: pulls use it as the cursor, so a slow client clock cannot hide a record.
async function upsert(db: D1Database, userId: string, op: Op, serverAt: number): Promise<void> {
  if (op.kind === 'workout') {
    await db
      .prepare(
        `INSERT INTO workouts (user_id, id, data, updated_at, server_at) VALUES (?, ?, ?, ?, ?)
         ON CONFLICT (user_id, id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at,
           server_at = excluded.server_at
         WHERE excluded.updated_at >= workouts.updated_at`,
      )
      .bind(userId, op.data.id, JSON.stringify(op.data), op.updatedAt, serverAt)
      .run();
  } else if (op.kind === 'settings') {
    await db
      .prepare(
        `INSERT INTO settings (user_id, data, updated_at, server_at) VALUES (?, ?, ?, ?)
         ON CONFLICT (user_id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at,
           server_at = excluded.server_at
         WHERE excluded.updated_at >= settings.updated_at`,
      )
      .bind(userId, JSON.stringify(op.data), op.updatedAt, serverAt)
      .run();
  } else if (op.kind === 'plan') {
    await db
      .prepare(
        `INSERT INTO plans (user_id, data, updated_at, server_at) VALUES (?, ?, ?, ?)
         ON CONFLICT (user_id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at,
           server_at = excluded.server_at
         WHERE excluded.updated_at >= plans.updated_at`,
      )
      .bind(userId, JSON.stringify(op.data), op.updatedAt, serverAt)
      .run();
  } else if (op.kind === 'suggestion') {
    await db
      .prepare(
        `INSERT INTO suggestions (user_id, id, data, updated_at, server_at) VALUES (?, ?, ?, ?, ?)
         ON CONFLICT (user_id, id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at,
           server_at = excluded.server_at
         WHERE excluded.updated_at >= suggestions.updated_at`,
      )
      .bind(userId, op.data.id, JSON.stringify(op.data), op.updatedAt, serverAt)
      .run();
  } else if (op.kind === 'cardio') {
    await db
      .prepare(
        `INSERT INTO cardio_sessions (user_id, id, data, updated_at, server_at) VALUES (?, ?, ?, ?, ?)
         ON CONFLICT (user_id, id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at,
           server_at = excluded.server_at
         WHERE excluded.updated_at >= cardio_sessions.updated_at`,
      )
      .bind(userId, op.data.id, JSON.stringify(op.data), op.updatedAt, serverAt)
      .run();
  } else if (op.kind === 'badge') {
    // First award wins and is never revoked: a second write for the same badge does nothing.
    await db
      .prepare(
        `INSERT INTO badges (user_id, badge_key, earned_at, server_at) VALUES (?, ?, ?, ?)
         ON CONFLICT (user_id, badge_key) DO NOTHING`,
      )
      .bind(userId, op.data.badgeKey, op.data.earnedAt, serverAt)
      .run();
  } else {
    await db
      .prepare(
        `INSERT INTO bodyweight (user_id, date, kg, updated_at, server_at) VALUES (?, ?, ?, ?, ?)
         ON CONFLICT (user_id, date) DO UPDATE SET kg = excluded.kg, updated_at = excluded.updated_at,
           server_at = excluded.server_at
         WHERE excluded.updated_at >= bodyweight.updated_at`,
      )
      .bind(userId, op.data.date, op.data.kg, op.updatedAt, serverAt)
      .run();
  }
}

export interface Pulled {
  workouts: unknown[];
  settings: unknown | null;
  bodyweight: { date: string; kg: number }[];
  plan: unknown | null;
  suggestions: unknown[];
  badges: { badgeKey: string; earnedAt: number }[];
  cardio: unknown[];
  serverTime: number;
}

export async function pull(db: D1Database, userId: string, since: number, now = Date.now()): Promise<Pulled> {
  const w = await db
    .prepare('SELECT data FROM workouts WHERE user_id = ? AND server_at > ? ORDER BY server_at')
    .bind(userId, since)
    .all<{ data: string }>();
  const s = await db
    .prepare('SELECT data FROM settings WHERE user_id = ? AND server_at > ?')
    .bind(userId, since)
    .first<{ data: string }>();
  const b = await db
    .prepare('SELECT date, kg FROM bodyweight WHERE user_id = ? AND server_at > ? ORDER BY date')
    .bind(userId, since)
    .all<{ date: string; kg: number }>();
  const p = await db
    .prepare('SELECT data FROM plans WHERE user_id = ? AND server_at > ?')
    .bind(userId, since)
    .first<{ data: string }>();
  const g = await db
    .prepare('SELECT data FROM suggestions WHERE user_id = ? AND server_at > ? ORDER BY server_at')
    .bind(userId, since)
    .all<{ data: string }>();
  const bd = await db
    .prepare('SELECT badge_key, earned_at FROM badges WHERE user_id = ? AND server_at > ? ORDER BY server_at')
    .bind(userId, since)
    .all<{ badge_key: string; earned_at: number }>();
  const c = await db
    .prepare('SELECT data FROM cardio_sessions WHERE user_id = ? AND server_at > ? ORDER BY server_at')
    .bind(userId, since)
    .all<{ data: string }>();
  return {
    workouts: w.results.map((r) => JSON.parse(r.data)),
    settings: s ? JSON.parse(s.data) : null,
    bodyweight: b.results,
    plan: p ? JSON.parse(p.data) : null,
    suggestions: g.results.map((r) => JSON.parse(r.data)),
    badges: bd.results.map((r) => ({ badgeKey: r.badge_key, earnedAt: r.earned_at })),
    cardio: c.results.map((r) => JSON.parse(r.data)),
    serverTime: now,
  };
}

// Everything the account holds (SPEC §6.3 export). Same shape as pull, from the beginning of time.
export async function exportAll(db: D1Database, userId: string): Promise<Pulled> {
  return pull(db, userId, -1, 0);
}
