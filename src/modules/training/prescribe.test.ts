import { describe, it, expect } from 'vitest';
import { prescribeFor } from './prescribe';
import type { Plan } from '../../domain/plan';
import type { Exercise } from '../../domain/exercise';
import type { Settings } from '../../domain/types';
import type { TemplateDay } from '../../domain/template';

const WEEK = 7 * 86_400_000;
const ex = (over: Partial<Exercise> = {}): Exercise =>
  ({ id: 'a', name: 'a', equipment: 'dumbbell', requires: ['dumbbell'], mechanic: 'compound', ...over }) as Exercise;
const settings: Settings = { daysPerWeek: 3, restSec: 90, owned: [4, 6, 8, 10] };
const day: TemplateDay = { index: 0, warmup: [], exerciseIds: ['a'], targets: { a: { sets: 4, repMin: 5, repMax: 8 } }, cooldown: [] };
const plan = (over: Partial<Plan> = {}): Plan => ({
  daysPerWeek: 3,
  days: [day],
  adjustments: [],
  updatedAt: 0,
  block: { weeks: 4, startedAt: 0, deloadLastWeek: true },
  ...over,
});
const run = (p: Plan, e: Exercise, now: number, d = day) => prescribeFor({ plan: p, day: d, ex: e, settings, workouts: [], now });

describe('prescribeFor', () => {
  it('uses the day target: its sets and the bottom of its rep range', () => {
    expect(run(plan(), ex(), 0)).toEqual({ w: 6, reps: 5, sets: 4 });
  });

  it('an accepted coach adjustment sets the weight for the next session', () => {
    expect(run(plan({ adjustments: [{ exerciseId: 'a', w: 8, at: 0 }] }), ex(), 0).w).toBe(8);
  });

  it('in the deload week a weighted exercise goes down to a lighter owned bell', () => {
    const p = run(plan(), ex(), 3 * WEEK + 1);
    expect(p.w).toBe(4);
    expect(p.sets).toBe(4);
  });

  it('in the deload week a reps-only exercise drops one set', () => {
    const bw = ex({ equipment: 'bodyweight', requires: [] });
    const noTargets = { ...day, targets: undefined };
    expect(run(plan({ days: [noTargets] }), bw, 3 * WEEK + 1, noTargets)).toEqual({ w: 0, reps: 6, sets: 2 });
  });

  it('with the deload off, the last week prescribes as usual', () => {
    const p = plan({ block: { weeks: 4, startedAt: 0, deloadLastWeek: false } });
    expect(run(p, ex(), 3 * WEEK + 1).w).toBe(6);
  });

  it('a plan saved before U4 (no block, no targets) uses the library rep range', () => {
    const old: Plan = { daysPerWeek: 3, days: [{ index: 0, warmup: [], exerciseIds: ['a'], cooldown: [] }], adjustments: [], updatedAt: 0 };
    expect(run(old, ex(), WEEK, old.days[0])).toEqual({ w: 6, reps: 6, sets: 3 });
  });
});
