import { describe, it, expect } from 'vitest';
import { blockOf, blockWeek, deloaded, isDeloadWeek, materializeBlock, nextSession, sessionsInBlock, targetOf } from './block';
import type { Plan } from './plan';
import type { Exercise } from './exercise';
import type { TemplateDay } from './template';

const WEEK = 7 * 86_400_000;
const T0 = 1_000_000_000_000;

const day = (index: number, extra: Partial<TemplateDay> = {}): TemplateDay => ({ index, warmup: [], exerciseIds: ['a'], cooldown: [], ...extra });
const plan = (over: Partial<Plan> = {}): Plan => ({ daysPerWeek: 3, days: [day(0), day(1), day(2)], adjustments: [], updatedAt: T0, ...over });
const ex = (mechanic: Exercise['mechanic']) => ({ id: 'a', mechanic }) as Exercise;

// A local date at noon whose weekday is `weekday` (0 = Sunday), so the tests do not depend on the machine's timezone.
function onWeekday(weekday: number): number {
  const d = new Date(2026, 10, 1, 12);
  d.setDate(1 + ((weekday - d.getDay() + 7) % 7));
  return d.getTime();
}

describe('blockOf', () => {
  it('defaults a plan saved before U4 to 8 weeks from updatedAt, with the deload on', () => {
    expect(blockOf(plan())).toEqual({ weeks: 8, startedAt: T0, deloadLastWeek: true });
  });
  it('uses the saved block', () => {
    const block = { weeks: 4 as const, startedAt: 5, deloadLastWeek: false };
    expect(blockOf(plan({ block }))).toEqual(block);
  });
});

describe('blockWeek', () => {
  const p = plan({ block: { weeks: 4, startedAt: T0, deloadLastWeek: true } });
  it('counts from week 1', () => {
    expect(blockWeek(p, T0)).toEqual({ week: 1, of: 4, over: false });
    expect(blockWeek(p, T0 + WEEK + 1)).toEqual({ week: 2, of: 4, over: false });
  });
  it('a clock before the start is still week 1', () => {
    expect(blockWeek(p, T0 - WEEK).week).toBe(1);
  });
  it('past the end it caps at the block length and says over', () => {
    expect(blockWeek(p, T0 + 3.5 * WEEK)).toEqual({ week: 4, of: 4, over: false });
    expect(blockWeek(p, T0 + 4 * WEEK)).toEqual({ week: 4, of: 4, over: true });
    expect(blockWeek(p, T0 + 11 * WEEK)).toEqual({ week: 4, of: 4, over: true });
  });
});

describe('isDeloadWeek', () => {
  const block = { weeks: 4 as const, startedAt: T0, deloadLastWeek: true };
  it('is true only in the last week', () => {
    expect(isDeloadWeek(plan({ block }), T0 + 2 * WEEK)).toBe(false);
    expect(isDeloadWeek(plan({ block }), T0 + 3 * WEEK)).toBe(true);
  });
  it('is false once the block is over, and when the toggle is off', () => {
    expect(isDeloadWeek(plan({ block }), T0 + 4 * WEEK)).toBe(false);
    expect(isDeloadWeek(plan({ block: { ...block, deloadLastWeek: false } }), T0 + 3 * WEEK)).toBe(false);
  });
});

describe('nextSession', () => {
  it('rotation cycles through the days by finished sessions', () => {
    const p = plan();
    expect(nextSession(p, 0, T0)?.index).toBe(0);
    expect(nextSession(p, 4, T0)?.index).toBe(1);
  });
  it('is null for a plan with no days', () => {
    expect(nextSession(plan({ days: [] }), 0, T0)).toBeNull();
  });
  const weekly = plan({ schedule: 'weekdays', weekdays: [1, 3, 5] }); // Monday, Wednesday, Friday
  it('weekdays: a scheduled weekday gives that day', () => {
    expect(nextSession(weekly, 9, onWeekday(3))?.index).toBe(1);
  });
  it('weekdays: an unscheduled day gives the next scheduled weekday', () => {
    expect(nextSession(weekly, 9, onWeekday(2))?.index).toBe(1);
    expect(nextSession(weekly, 9, onWeekday(4))?.index).toBe(2);
  });
  it('weekdays: after the last scheduled weekday it wraps to the first, across Sunday', () => {
    expect(nextSession(weekly, 9, onWeekday(6))?.index).toBe(0);
    expect(nextSession(weekly, 9, onWeekday(0))?.index).toBe(0);
  });
  it('weekdays with a missing or wrong-length list falls back to rotation', () => {
    expect(nextSession(plan({ schedule: 'weekdays' }), 1, T0)?.index).toBe(1);
    expect(nextSession(plan({ schedule: 'weekdays', weekdays: [1] }), 1, T0)?.index).toBe(1);
  });
});

describe('targetOf', () => {
  it('falls back to the library rep range and the default sets', () => {
    expect(targetOf(day(0), ex('compound'))).toEqual({ sets: 3, repMin: 6, repMax: 10 });
    expect(targetOf(day(0), ex('isolation'))).toEqual({ sets: 3, repMin: 10, repMax: 15 });
  });
  it('uses the day target when there is one', () => {
    const t = { sets: 4, repMin: 5, repMax: 8 };
    expect(targetOf(day(0, { targets: { a: t } }), ex('compound'))).toEqual(t);
  });
});

describe('deloaded', () => {
  it('a weighted prescription goes down to an owned bell', () => {
    const out = deloaded({ w: 20, reps: 8, sets: 3 }, true, [4, 8, 12, 16, 20]);
    expect(out.w).toBeLessThan(20);
    expect([4, 8, 12, 16, 20]).toContain(out.w);
    expect(out.sets).toBe(3);
  });
  it('an unweighted one drops a set, never below 1', () => {
    expect(deloaded({ w: 0, reps: 10, sets: 3 }, false, [])).toEqual({ w: 0, reps: 10, sets: 2 });
    expect(deloaded({ w: 0, reps: 10, sets: 1 }, false, []).sets).toBe(1);
  });
});

describe('materializeBlock', () => {
  it('pins an old plan block start so later edits (which move updatedAt) do not restart the week count', () => {
    const old = plan();
    const pinned = materializeBlock(old);
    expect(pinned.block).toEqual({ weeks: 8, startedAt: T0, deloadLastWeek: true });
    expect(blockOf({ ...pinned, updatedAt: T0 + 5 * WEEK }).startedAt).toBe(T0);
  });
  it('returns the same plan when it already has a block', () => {
    const p = plan({ block: { weeks: 4, startedAt: 7, deloadLastWeek: true } });
    expect(materializeBlock(p)).toBe(p);
  });
});

describe('nextSession: what is already done', () => {
  const weekly = plan({ schedule: 'weekdays', weekdays: [1, 3, 5] }); // Monday, Wednesday, Friday
  it("weekdays: once today's session is logged, the next scheduled weekday is offered", () => {
    const wed = onWeekday(3);
    expect(nextSession(weekly, 9, wed, [wed - 3_600_000])?.index).toBe(2);
  });
  it('weekdays: a session logged on another day does not skip today', () => {
    const wed = onWeekday(3);
    expect(nextSession(weekly, 9, wed, [wed - 2 * 86_400_000])?.index).toBe(1);
  });
  it('weekdays: after the last scheduled day is done it wraps to the first', () => {
    const fri = onWeekday(5);
    expect(nextSession(weekly, 9, fri, [fri - 1000])?.index).toBe(0);
  });
});

describe('sessionsInBlock', () => {
  it('counts only workouts since the block started, so a new plan starts at its first day', () => {
    const p = plan({ block: { weeks: 8, startedAt: 100, deloadLastWeek: true } });
    expect(sessionsInBlock(p, [{ start: 50 }, { start: 100 }, { start: 200 }])).toBe(2);
  });
  it('a plan saved before U4 counts from its last save', () => {
    expect(sessionsInBlock(plan({ updatedAt: 100 }), [{ start: 50 }, { start: 150 }])).toBe(1);
  });
});
