import { describe, it, expect } from 'vitest';
import type { Exercise } from '../../../domain/exercise';
import type { Goal, Workout } from '../../../domain/types';
import type { Group } from './muscles';
import type { CardioSession } from '../../../domain/cardio';
import { generateQuests, questBonusByGroup, monthBounds, monthKey, monthlyRecap, questHave, weekKey } from './game';
import { streakWithFreezes } from './streak';

// Monday 5 Oct 2026, 10:00 local. Week n starts at MON + 7n days (no DST change inside a test needs exact hours).
const MON = new Date(2026, 9, 5, 10).getTime();
const wk = (n: number, day = 0) => new Date(2026, 9, 5 + 7 * n + day, 10).getTime();

const ex: Record<string, Pick<Exercise, 'primaryMuscles' | 'mode'> & Partial<Exercise>> = {
  bench: { primaryMuscles: ['chest'], mode: 'reps' },
  row: { primaryMuscles: ['middle back'], mode: 'reps' },
  plank: { primaryMuscles: ['abdominals'], mode: 'time' },
};
const byId = (id: string) => ex[id];
const workout = (start: number, ids: string[], w = 10, rir?: number): Workout => ({
  id: String(start),
  start,
  end: start + 3_600_000,
  entries: ids.map((exerciseId) => ({
    exerciseId,
    planned: { w, reps: 10, sets: 1 },
    sets: [{ w, r: 10, done: true, phase: 'work' as const, at: start, ...(rir === undefined ? {} : { rir }) }],
  })),
});

describe('streakWithFreezes (1 session a week)', () => {
  const weeks = (ns: number[]) => ns.map((n) => wk(n));
  it('earns a freeze per 4 completed weeks and spends it on a missed week', () => {
    // weeks 0–3 done (1 freeze), week 4 missed (spent), week 5 done.
    expect(streakWithFreezes(weeks([0, 1, 2, 3, 5]), 1, wk(5))).toEqual({ streak: 5, freezes: 0, frozen: 1 });
  });
  it('resets without a freeze; completed weeks still count toward the next freeze', () => {
    expect(streakWithFreezes(weeks([0, 1, 2, 4]), 1, wk(4))).toEqual({ streak: 1, freezes: 1, frozen: 0 });
  });
  it('holds at most 2 freezes', () => {
    expect(streakWithFreezes(weeks([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]), 1, wk(11)).freezes).toBe(2);
  });
  it('two missed weeks need two freezes', () => {
    const done = [0, 1, 2, 3, 4, 5, 6, 7];
    expect(streakWithFreezes(weeks([...done, 10]), 1, wk(10))).toEqual({ streak: 9, freezes: 0, frozen: 2 });
    expect(streakWithFreezes(weeks([...done, 11]), 1, wk(11)).streak).toBe(1);
  });
  it('the open week does not break or spend', () => {
    expect(streakWithFreezes(weeks([0, 1, 2, 3]), 1, wk(4, 6))).toEqual({ streak: 4, freezes: 1, frozen: 0 });
  });
  it('a session late on Sunday counts for that week', () => {
    const sundayNight = new Date(2026, 9, 11, 23, 59).getTime();
    expect(streakWithFreezes([sundayNight], 1, wk(1))).toEqual({ streak: 1, freezes: 0, frozen: 0 });
  });
});

describe('generateQuests', () => {
  const base = { daysPerWeek: 3, planGroups: ['chest', 'back'] as const, goals: ['build-muscle'] as Goal[], exerciseById: byId };
  it('is deterministic and picks the least-trained plan group', () => {
    const ws = [workout(wk(2), ['bench']), workout(wk(2, 2), ['bench', 'row']), workout(wk(3), ['bench'])];
    const a = generateQuests({ ...base, planGroups: [...base.planGroups], workouts: ws, now: wk(4, 3) });
    expect(a).toEqual(generateQuests({ ...base, planGroups: [...base.planGroups], workouts: ws, now: wk(4, 1) }));
    expect(a[0]).toEqual({ kind: 'sessions', need: 3 });
    expect(a[1]).toEqual({ kind: 'group', group: 'back', need: 2 });
    expect(a[2]).toEqual({ kind: 'rir', need: 2 }); // no RIR logged
  });
  it('ignores sessions in the current week and before the lookback', () => {
    const ws = [workout(wk(4), ['row']), workout(wk(4), ['row']), workout(wk(0), ['row'])];
    expect(generateQuests({ ...base, planGroups: [...base.planGroups], workouts: ws, now: wk(4, 2) })[1]).toEqual({ kind: 'group', group: 'chest', need: 2 });
  });
  it('follows the goals in order, then fills up to 3', () => {
    const ws = [workout(wk(3), ['bench'], 10, 2)]; // RIR always logged: no RIR filler
    const q = (goals: Goal[], planGroups: Group[] = []) => generateQuests({ ...base, goals, planGroups, workouts: ws, now: wk(4) });
    expect(q(['lose-fat', 'endurance'])).toEqual([
      { kind: 'sessions', need: 3 },
      { kind: 'cardio', need: 2 },
      { kind: 'cardioMinutes', need: 60 },
    ]);
    expect(q(['strength'])).toEqual([
      { kind: 'sessions', need: 3 },
      { kind: 'pr', need: 1 },
    ]);
    expect(q(['mobility', 'health'], ['chest', 'back'])).toEqual([
      { kind: 'sessions', need: 3 },
      { kind: 'timed', need: 6 },
      { kind: 'variety', need: 2 }, // capped at the groups the plan trains
    ]);
    expect(q(['strength'], ['chest'])[1]).toEqual({ kind: 'pr', need: 1 });
    expect(q(['strength'], ['chest'])[2]).toEqual({ kind: 'group', group: 'chest', need: 2 }); // filler
  });
});

describe('questHave', () => {
  const cardio = [{ start: wk(4, 6) } as CardioSession, { start: wk(5) } as CardioSession];
  const ws = [workout(wk(3), ['bench'], 10), workout(wk(4), ['bench', 'plank'], 12, 1), workout(wk(4, 6), ['row'], 10), workout(wk(5), ['bench'], 20)];
  const h = { workouts: ws, cardio, slotStarts: ws.map((w) => w.start), exerciseById: byId, weekOf: wk(4, 2) };
  it('counts only inside the week (Mon 00:00 to Sun 23:59) and caps at need', () => {
    expect(questHave({ kind: 'sessions', need: 3 }, h)).toBe(2);
    expect(questHave({ kind: 'sessions', need: 1 }, h)).toBe(1);
    expect(questHave({ kind: 'group', group: 'back', need: 2 }, h)).toBe(1);
    expect(questHave({ kind: 'cardio', need: 1 }, h)).toBe(1);
    expect(questHave({ kind: 'rir', need: 2 }, h)).toBe(1); // timed plank needs no RIR
    expect(questHave({ kind: 'pr', need: 1 }, h)).toBe(1); // bench 12 > 10
  });
  it('counts cardio minutes, holds and muscle variety in the week', () => {
    const withMin = { ...h, cardio: [{ start: wk(4, 1), minutes: 25 } as CardioSession, { start: wk(4, 3), minutes: 20 } as CardioSession] };
    expect(questHave({ kind: 'cardioMinutes', need: 60 }, withMin)).toBe(45);
    expect(questHave({ kind: 'timed', need: 6 }, h)).toBe(1); // one plank set
    expect(questHave({ kind: 'variety', need: 6 }, h)).toBe(3); // chest, core, back
  });
});

describe('keys and months', () => {
  it('week key is the local Monday, month key the local month', () => {
    expect(weekKey(wk(0, 6))).toBe('2026-10-05');
    expect(monthKey(new Date(2026, 9, 31, 23, 59).getTime())).toBe('2026-10');
    expect(monthKey(new Date(2026, 10, 1, 0, 0).getTime())).toBe('2026-11');
    const b = monthBounds(MON);
    expect(new Date(b.from).getDate()).toBe(1);
    expect(new Date(b.to).getMonth()).toBe(10);
  });
});

describe('monthlyRecap', () => {
  it('counts only the month, across the month boundary', () => {
    const full = (id: string): Exercise => ({ ...(ex[id] as Exercise), id, name: id, secondaryMuscles: [], muscles: { primary: [], secondary: [] }, equipment: 'dumbbell', requires: [] } as Exercise);
    const ws = [
      workout(new Date(2026, 8, 30, 10).getTime(), ['bench'], 10),
      workout(new Date(2026, 9, 1, 10).getTime(), ['bench'], 12),
      workout(new Date(2026, 9, 31, 23, 0).getTime(), ['row'], 10),
      workout(new Date(2026, 10, 1, 1, 0).getTime(), ['bench'], 30),
    ];
    const r = monthlyRecap(
      { workouts: ws, exerciseById: (id) => (ex[id] ? full(id) : undefined), bodyweight: [], daysPerWeek: 3, repMaxFor: () => 12, now: wk(6) },
      MON,
    );
    expect(r.sessions).toBe(2);
    expect(r.volumeKg).toBe(12 * 10 + 10 * 10);
    expect(r.prs).toBe(1);
    expect(r.xp).toBeGreaterThan(0);
    expect(r.topGroups[0]).toBeDefined();
    expect(r.ranksGained).toEqual([]); // no bodyweight: no rank-ups
  });
});

describe('questBonusByGroup', () => {
  it('a train-X quest feeds its muscle; other finished quests split over the muscles trained that week', () => {
    const ws = [workout(wk(4), ['bench']), workout(wk(4, 2), ['row'])];
    const h = { workouts: ws, cardio: [], slotStarts: ws.map((w) => w.start), exerciseById: byId };
    const bonus = questBonusByGroup(
      [{ weekOf: wk(4), quests: [{ kind: 'group', group: 'back', need: 1 }, { kind: 'sessions', need: 2 }, { kind: 'pr', need: 1 }] }],
      h,
    );
    expect(bonus).toEqual({ back: 500 + 250, chest: 250 }); // pr not done: nothing
  });
});
