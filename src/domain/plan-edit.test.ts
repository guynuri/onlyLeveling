import { describe, it, expect } from 'vitest';
import { addExercise, extendBlock, moveExercise, removeExercise, replaceInDay, setDeload, setSchedule, setTarget, startBlock } from './plan-edit';
import type { Plan } from './plan';

const T = { sets: 3, repMin: 8, repMax: 12 };
const base = (): Plan => ({
  daysPerWeek: 2,
  days: [
    { index: 0, warmup: [], exerciseIds: ['a', 'b'], targets: { a: T, b: { sets: 4, repMin: 5, repMax: 8 } }, cooldown: [] },
    { index: 1, warmup: [], exerciseIds: ['b', 'c'], cooldown: [] },
  ],
  adjustments: [{ exerciseId: 'a', w: 8, at: 1 }],
  updatedAt: 1,
});
const NOW = 99;

describe('addExercise', () => {
  it('adds to the end of the day with its target and stamps updatedAt', () => {
    const p = addExercise(base(), 1, 'z', T, NOW);
    expect(p.days[1].exerciseIds).toEqual(['b', 'c', 'z']);
    expect(p.days[1].targets?.z).toEqual(T);
    expect(p.updatedAt).toBe(NOW);
  });
  it('ignores an exercise already in that day, an unknown day, and a bad target', () => {
    const p = base();
    expect(addExercise(p, 0, 'a', T, NOW)).toBe(p);
    expect(addExercise(p, 7, 'z', T, NOW)).toBe(p);
    expect(addExercise(p, 0, 'z', { sets: 0, repMin: 8, repMax: 12 }, NOW)).toBe(p);
  });
});

describe('removeExercise', () => {
  it('removes the exercise and its target', () => {
    const p = removeExercise(base(), 0, 'b', NOW);
    expect(p.days[0].exerciseIds).toEqual(['a']);
    expect(p.days[0].targets?.b).toBeUndefined();
  });
  it('refuses the last exercise of a day', () => {
    const p = removeExercise(base(), 0, 'b', NOW);
    expect(removeExercise(p, 0, 'a', NOW)).toBe(p);
  });
  it('drops the weight adjustment only when no day uses the exercise any more', () => {
    const withA = { ...base(), days: [base().days[0], { ...base().days[1], exerciseIds: ['a', 'c'] }] };
    expect(removeExercise(withA, 0, 'a', NOW).adjustments).toHaveLength(1);
    const p = removeExercise(base(), 0, 'a', NOW);
    expect(p.adjustments).toEqual([]);
  });
});

describe('moveExercise', () => {
  it('moves down and up inside the day', () => {
    expect(moveExercise(base(), 0, 'a', 1, NOW).days[0].exerciseIds).toEqual(['b', 'a']);
    expect(moveExercise(base(), 0, 'b', -1, NOW).days[0].exerciseIds).toEqual(['b', 'a']);
  });
  it('does nothing at the ends', () => {
    const p = base();
    expect(moveExercise(p, 0, 'a', -1, NOW)).toBe(p);
    expect(moveExercise(p, 0, 'b', 1, NOW)).toBe(p);
  });
});

describe('setTarget', () => {
  it('sets sets and the rep range', () => {
    expect(setTarget(base(), 0, 'a', { sets: 5, repMin: 3, repMax: 5 }, NOW).days[0].targets?.a).toEqual({ sets: 5, repMin: 3, repMax: 5 });
  });
  it.each([
    [{ sets: 6, repMin: 8, repMax: 12 }],
    [{ sets: 3, repMin: 12, repMax: 8 }],
    [{ sets: 3, repMin: 0, repMax: 8 }],
    [{ sets: 3, repMin: 8, repMax: 51 }],
    [{ sets: 2.5, repMin: 8, repMax: 12 }],
  ])('rejects %o', (target) => {
    const p = base();
    expect(setTarget(p, 0, 'a', target, NOW)).toBe(p);
  });
});

describe('replaceInDay', () => {
  it('swaps one exercise in one day only, keeping its target and place', () => {
    const p = replaceInDay(base(), 0, 'b', 'z', NOW);
    expect(p.days[0].exerciseIds).toEqual(['a', 'z']);
    expect(p.days[0].targets?.z).toEqual({ sets: 4, repMin: 5, repMax: 8 });
    expect(p.days[0].targets?.b).toBeUndefined();
    expect(p.days[1].exerciseIds).toEqual(['b', 'c']);
  });
  it('refuses a replacement already in the day', () => {
    const p = base();
    expect(replaceInDay(p, 0, 'a', 'b', NOW)).toBe(p);
  });
  it('drops the adjustment of an exercise no day uses any more', () => {
    expect(replaceInDay(base(), 0, 'a', 'z', NOW).adjustments).toEqual([]);
  });
});

describe('blocks and schedule', () => {
  it('extendBlock adds weeks to the block and caps at 12', () => {
    const p = { ...base(), block: { weeks: 8 as const, startedAt: 5, deloadLastWeek: true } };
    expect(extendBlock(p, 2, NOW).block).toEqual({ weeks: 10, startedAt: 5, deloadLastWeek: true });
    expect(extendBlock(p, 9, NOW).block?.weeks).toBe(12);
  });
  it('extendBlock works on a plan saved before U4 (8-week default)', () => {
    expect(extendBlock(base(), 2, NOW).block?.weeks).toBe(10);
  });
  it('startBlock restarts the clock and keeps the deload choice', () => {
    const p = { ...base(), block: { weeks: 8 as const, startedAt: 5, deloadLastWeek: false } };
    expect(startBlock(p, 4, NOW).block).toEqual({ weeks: 4, startedAt: NOW, deloadLastWeek: false });
  });
  it('setDeload toggles the last-week deload', () => {
    expect(setDeload(base(), false, NOW).block?.deloadLastWeek).toBe(false);
  });
  it('setSchedule: weekdays need one ascending weekday per day', () => {
    expect(setSchedule(base(), 'weekdays', [1, 4], NOW)).toMatchObject({ schedule: 'weekdays', weekdays: [1, 4] });
    const p = base();
    expect(setSchedule(p, 'weekdays', [1], NOW)).toBe(p);
    expect(setSchedule(p, 'weekdays', [4, 1], NOW)).toBe(p);
    expect(setSchedule(p, 'weekdays', [1, 9], NOW)).toBe(p);
  });
  it('setSchedule back to rotation clears the weekdays', () => {
    const w = setSchedule(base(), 'weekdays', [1, 4], NOW);
    const r = setSchedule(w, 'rotation', undefined, NOW);
    expect(r.schedule).toBe('rotation');
    expect(r.weekdays).toBeUndefined();
  });
});
