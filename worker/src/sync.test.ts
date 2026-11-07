import { describe, it, expect, beforeEach } from 'vitest';
import { env } from 'cloudflare:test';
import { applyPush, pull, exportAll, parseOps, type Op } from './sync';
import type { Env } from './env';

const db = (env as unknown as Env).DB;
const A = 'u_a';
const B = 'u_b';

// Each test gets a clean database; the migrations are applied once per file in setup.ts.
beforeEach(async () => {
  for (const t of ['workouts', 'settings', 'bodyweight', 'plans', 'suggestions', 'badges', 'cardio_sessions', 'game_records', 'ops_applied']) {
    await db.prepare(`DELETE FROM ${t}`).run();
  }
});

const workout = (id: string, reps: number): { id: string } & Record<string, unknown> => ({
  id,
  start: 1,
  end: 2,
  entries: [{ exerciseId: 'fx_x', sets: [{ w: 8, r: reps, done: true }] }],
});

const wOp = (opId: string, id: string, reps: number, updatedAt: number): Op => ({
  opId,
  kind: 'workout',
  data: workout(id, reps),
  updatedAt,
});

describe('push: idempotent and last write wins', () => {
  it('applies a workout op once; the same op id again changes nothing', async () => {
    const first = await applyPush(db, A, [wOp('op1', 'w1', 10, 100)], 1000);
    const again = await applyPush(db, A, [wOp('op1', 'w1', 10, 100)], 1000);
    expect(first).toEqual({ applied: 1, duplicates: 0 });
    expect(again).toEqual({ applied: 0, duplicates: 1 });
    const rows = await exportAll(db, A);
    expect(rows.workouts).toHaveLength(1);
  });

  it('a later write wins; an older write does not resurrect itself', async () => {
    await applyPush(db, A, [wOp('op-new', 'w1', 12, 200)], 1000);
    await applyPush(db, A, [wOp('op-old', 'w1', 6, 100)], 1000);
    const rows = await exportAll(db, A);
    expect(rows.workouts).toHaveLength(1);
    expect((rows.workouts[0] as { entries: { sets: { r: number }[] }[] }).entries[0].sets[0].r).toBe(12);
  });

  it('settings are one record per user; a later write wins', async () => {
    const s = (days: number, updatedAt: number): Op => ({
      opId: `s${days}-${updatedAt}`,
      kind: 'settings',
      data: { daysPerWeek: days, restSec: 90, owned: [4, 6] },
      updatedAt,
    });
    await applyPush(db, A, [s(3, 100), s(4, 200), s(2, 50)], 1000);
    const rows = await exportAll(db, A);
    expect((rows.settings as { daysPerWeek: number }).daysPerWeek).toBe(4);
  });

  it('bodyweight is keyed by date', async () => {
    const bw = (kg: number, updatedAt: number): Op => ({
      opId: `bw-${kg}-${updatedAt}`,
      kind: 'bodyweight',
      data: { date: '2026-11-05', kg },
      updatedAt,
    });
    await applyPush(db, A, [bw(82, 100), bw(81.5, 200)], 1000);
    const rows = await exportAll(db, A);
    expect(rows.bodyweight).toEqual([{ date: '2026-11-05', kg: 81.5 }]);
  });
});

describe('tenant isolation (SPEC §10: a user cannot read another user’s records)', () => {
  it('user B cannot read user A’s workouts, settings or bodyweight', async () => {
    await applyPush(db, A, [wOp('a1', 'w1', 10, 100)], 1000);
    const b = await exportAll(db, B);
    expect(b.workouts).toEqual([]);
    expect(b.settings).toBeNull();
    expect(b.bodyweight).toEqual([]);
    expect((await pull(db, B, 0)).workouts).toEqual([]);
  });

  it('user B pushing the same record id does not overwrite user A’s record', async () => {
    await applyPush(db, A, [wOp('a1', 'same', 10, 100)], 1000);
    await applyPush(db, B, [wOp('b1', 'same', 3, 999)], 1000);
    const a = await exportAll(db, A);
    expect((a.workouts[0] as { entries: { sets: { r: number }[] }[] }).entries[0].sets[0].r).toBe(10);
  });

  it('the same op id from two users is applied for each user, not dropped', async () => {
    await applyPush(db, A, [wOp('shared-op', 'wa', 10, 100)], 1000);
    const r = await applyPush(db, B, [wOp('shared-op', 'wb', 5, 100)], 1000);
    expect(r.applied).toBe(1);
    expect((await exportAll(db, B)).workouts).toHaveLength(1);
  });
});

describe('pull and export', () => {
  it('pull returns only records the server received after `since`', async () => {
    await applyPush(db, A, [wOp('o1', 'old', 10, 100)], 100);
    await applyPush(db, A, [wOp('o2', 'new', 10, 100)], 300);
    const p = await pull(db, A, 200);
    expect(p.workouts.map((w) => (w as { id: string }).id)).toEqual(['new']);
    expect(typeof p.serverTime).toBe('number');
    expect(p.serverTime).toBeGreaterThan(0);
  });

  it('a phone whose clock runs behind still gets its records: the cursor is server time, not client time', async () => {
    // The client stamped updatedAt=50, but the server received the write at 300. A cursor of 200 (a server
    // time from an earlier pull) must still return it.
    await applyPush(db, A, [wOp('skew', 'slow-clock', 10, 50)], 300);
    const p = await pull(db, A, 200);
    expect(p.workouts.map((w) => (w as { id: string }).id)).toEqual(['slow-clock']);
  });

  it('export contains every record of the account', async () => {
    await applyPush(
      db,
      A,
      [
        wOp('e1', 'w1', 10, 100),
        wOp('e2', 'w2', 10, 110),
        { opId: 'e3', kind: 'bodyweight', data: { date: '2026-11-01', kg: 80 }, updatedAt: 120 },
      ],
      1000,
    );
    const e = await exportAll(db, A);
    expect(e.workouts).toHaveLength(2);
    expect(e.bodyweight).toHaveLength(1);
  });
});

describe('parseOps (trust boundary: reject what we do not understand)', () => {
  it('accepts a valid list', () => {
    expect(parseOps({ ops: [wOp('x', 'w', 1, 1)] })).toHaveLength(1);
  });

  it('rejects an unknown kind, a missing op id, or a non-list body', () => {
    expect(() => parseOps({ ops: [{ opId: 'x', kind: 'drop-table', data: {}, updatedAt: 1 }] })).toThrow();
    expect(() => parseOps({ ops: [{ kind: 'workout', data: { id: 'w' }, updatedAt: 1 }] })).toThrow();
    expect(() => parseOps({ ops: 'nope' })).toThrow();
    expect(() => parseOps(null)).toThrow();
  });

  it('rejects a batch over the size limit', () => {
    const many = Array.from({ length: 501 }, (_, i) => wOp(`o${i}`, `w${i}`, 1, 1));
    expect(() => parseOps({ ops: many })).toThrow(/too many/i);
  });
});

describe('plan and suggestions (Phase 5): last write wins, scoped by user', () => {
  const plan = (daysPerWeek: number, updatedAt: number): Op => ({
    opId: `p${updatedAt}`,
    kind: 'plan',
    data: { daysPerWeek, days: [], adjustments: [], updatedAt },
    updatedAt,
  });
  const sug = (id: string, status: string, updatedAt: number): Op => ({
    opId: `s${id}${updatedAt}`,
    kind: 'suggestion',
    data: { id, status },
    updatedAt,
  });

  it('keeps one plan per user; the newer write wins, an older one does not', async () => {
    await applyPush(db, A, [plan(3, 200)], 1000);
    await applyPush(db, A, [plan(4, 100)], 1001); // older client clock: ignored
    expect((await exportAll(db, A)).plan).toMatchObject({ daysPerWeek: 3 });
    await applyPush(db, A, [plan(4, 300)], 1002);
    expect((await exportAll(db, A)).plan).toMatchObject({ daysPerWeek: 4 });
  });

  it('a v2 plan (block, targets, weekdays, cardio minutes) round-trips unchanged: no schema change is needed', async () => {
    const data = {
      daysPerWeek: 2,
      days: [
        { index: 0, label: 'Upper A', warmup: [], exerciseIds: ['fx_a'], targets: { fx_a: { sets: 4, repMin: 5, repMax: 8 } }, postCardioMinutes: 20, mobilityMinutes: 5, cooldown: [] },
        { index: 1, label: 'Lower A', warmup: [], exerciseIds: ['fx_b'], cooldown: [] },
      ],
      adjustments: [],
      block: { weeks: 10, startedAt: 5, deloadLastWeek: false },
      schedule: 'weekdays',
      weekdays: [1, 4],
      updatedAt: 400,
    };
    await applyPush(db, A, [{ opId: 'v2', kind: 'plan', data, updatedAt: 400 }], 1000);
    expect((await exportAll(db, A)).plan).toEqual(data);
  });

  it('stores suggestions per id and pulls them since the cursor', async () => {
    await applyPush(db, A, [sug('stall:x', 'pending', 10), sug('stale:y', 'pending', 10)], 1000);
    expect((await exportAll(db, A)).suggestions).toHaveLength(2);
    expect((await pull(db, A, 1000, 2000)).suggestions).toHaveLength(0);
  });

  it('never shows one user another user\'s plan or suggestions', async () => {
    await applyPush(db, A, [plan(3, 1), sug('stall:x', 'pending', 1)], 1000);
    const other = await exportAll(db, B);
    expect(other.plan).toBeNull();
    expect(other.suggestions).toHaveLength(0);
  });

  it('rejects a plan without daysPerWeek and a suggestion without an id', () => {
    expect(() => parseOps({ ops: [{ opId: 'x', kind: 'plan', data: {}, updatedAt: 1 }] })).toThrow();
    expect(() => parseOps({ ops: [{ opId: 'x', kind: 'suggestion', data: {}, updatedAt: 1 }] })).toThrow();
  });
});

describe('badges (Phase 6): first award wins, never revoked', () => {
  const badge = (opId: string, badgeKey: string, earnedAt: number): Op => ({
    opId,
    kind: 'badge',
    data: { badgeKey, earnedAt },
    updatedAt: earnedAt,
  });

  it('a later write for the same badge does not change the first one', async () => {
    await applyPush(db, A, [badge('b1', 'session:10', 100)], 1000);
    await applyPush(db, A, [badge('b2', 'session:10', 999)], 2000);
    const rows = (await exportAll(db, A)).badges;
    expect(rows).toEqual([{ badgeKey: 'session:10', earnedAt: 100 }]);
  });

  it('badges are scoped by user', async () => {
    await applyPush(db, A, [badge('b3', 'pr:first', 100)], 1000);
    expect((await exportAll(db, B)).badges).toEqual([]);
  });

  it('rejects a badge without a key', () => {
    expect(() => parseOps({ ops: [{ opId: 'x', kind: 'badge', data: { earnedAt: 1 }, updatedAt: 1 }] })).toThrow();
  });

  it('accepts only the keys the app produces', () => {
    const op = (badgeKey: string) => ({ ops: [{ opId: 'x', kind: 'badge', data: { badgeKey, earnedAt: 1 }, updatedAt: 1 }] });
    for (const k of ['session:10', 'pr:first', 'rankup:first', 'muscle:chest:C', 'muscle:core:SSS']) {
      expect(() => parseOps(op(k))).not.toThrow();
    }
    for (const k of ['x', 'x'.repeat(1000), 'session:11', 'muscle:chest:F', 'muscle:arms:C']) {
      expect(() => parseOps(op(k))).toThrow();
    }
  });
});

describe('cardio sessions (U5b)', () => {
  const cardio = (id: string, minutes: number, updatedAt: number): Op => ({
    opId: `c-${id}-${updatedAt}`,
    kind: 'cardio',
    data: { id, start: 5, minutes, type: 'run', planDay: 1 },
    updatedAt,
  });

  it('round-trips through push, pull and export; the newer write wins', async () => {
    await applyPush(db, A, [cardio('c1', 30, 100)], 1000);
    await applyPush(db, A, [cardio('c1', 10, 50)], 1001); // older client clock: ignored
    await applyPush(db, A, [cardio('c1', 45, 200)], 1002);
    expect((await exportAll(db, A)).cardio).toEqual([{ id: 'c1', start: 5, minutes: 45, type: 'run', planDay: 1 }]);
    expect((await pull(db, A, 1001, 2000)).cardio).toHaveLength(1);
    expect((await pull(db, A, 1002, 2000)).cardio).toHaveLength(0);
  });

  it("never shows one user another user's cardio", async () => {
    await applyPush(db, A, [cardio('c1', 30, 100)], 1000);
    expect((await exportAll(db, B)).cardio).toEqual([]);
  });

  it.each([
    ['a missing start', { start: undefined }],
    ['a non-numeric start', { start: 'now' }],
    ['effort 11', { effort: 11 }],
    ['effort 0', { effort: 0 }],
    ['a distance of 0', { distanceKm: 0 }],
    ['a distance over 500', { distanceKm: 501 }],
    ['a fractional plan day', { planDay: 1.5 }],
    ['a negative plan day', { planDay: -1 }],
    ['minutes over 600', { minutes: 601 }],
    ['an afterWorkoutId that is not text', { afterWorkoutId: 7 }],
  ])('rejects %s', (_name, over) => {
    const data = { id: 'c1', start: 5, minutes: 30, type: 'run', ...over };
    expect(() => parseOps({ ops: [{ opId: 'x', kind: 'cardio', data, updatedAt: 1 }] })).toThrow();
  });
  it('accepts the optional fields when they are valid', () => {
    const data = { id: 'c1', start: 5, minutes: 30, type: 'run', effort: 7, distanceKm: 5.2, planDay: 0, afterWorkoutId: 'w_1' };
    expect(parseOps({ ops: [{ opId: 'x', kind: 'cardio', data, updatedAt: 1 }] })).toHaveLength(1);
  });
  it('rejects a cardio op with no minutes, no type or no id', () => {
    const bad = (data: Record<string, unknown>) => () => parseOps({ ops: [{ opId: 'x', kind: 'cardio', data, updatedAt: 1 }] });
    expect(bad({ id: 'c1', type: 'run' })).toThrow();
    expect(bad({ id: 'c1', minutes: 0, type: 'run' })).toThrow();
    expect(bad({ id: 'c1', minutes: 30 })).toThrow();
    expect(bad({ minutes: 30, type: 'run' })).toThrow();
  });
});

describe('game records (U7): first write wins, known keys only', () => {
  const game = (opId: string, key: string, data: unknown, at: number): Op => ({ opId, kind: 'game', data: { key, data, at }, updatedAt: at });

  it('keeps the first write and pulls it back', async () => {
    await applyPush(db, A, [game('g1', 'quests:2026-11-02', [{ kind: 'sessions', need: 3 }], 100)], 1000);
    await applyPush(db, A, [game('g2', 'quests:2026-11-02', [], 200)], 2000);
    expect((await exportAll(db, A)).game).toEqual([{ key: 'quests:2026-11-02', data: [{ kind: 'sessions', need: 3 }], at: 100 }]);
    expect((await exportAll(db, B)).game).toEqual([]);
  });

  it('rejects unknown keys and large data', () => {
    const op = (key: string, data: unknown = null) => ({ ops: [{ opId: 'x', kind: 'game', data: { key, data, at: 1 }, updatedAt: 1 }] });
    expect(() => parseOps(op('recap:2026-11'))).not.toThrow();
    for (const k of ['x', 'quests:2026-1-2', 'recap:2026-11-01']) expect(() => parseOps(op(k))).toThrow();
    expect(() => parseOps(op('recap:2026-11', 'x'.repeat(3000)))).toThrow();
  });
});
