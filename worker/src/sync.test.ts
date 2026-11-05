import { describe, it, expect, beforeEach } from 'vitest';
import { env } from 'cloudflare:test';
import { applyPush, pull, exportAll, parseOps, type Op } from './sync';
import type { Env } from './env';

const db = (env as unknown as Env).DB;
const A = 'u_a';
const B = 'u_b';

// Each test gets a clean database; the migrations are applied once per file in setup.ts.
beforeEach(async () => {
  for (const t of ['workouts', 'settings', 'bodyweight', 'ops_applied']) {
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
  it('pull returns only records changed after `since`', async () => {
    await applyPush(db, A, [wOp('o1', 'old', 10, 100), wOp('o2', 'new', 10, 300)], 1000);
    const p = await pull(db, A, 200);
    expect(p.workouts.map((w) => (w as { id: string }).id)).toEqual(['new']);
    expect(typeof p.serverTime).toBe('number');
    expect(p.serverTime).toBeGreaterThan(0);
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
