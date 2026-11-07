import { describe, it, expect } from 'vitest';
import { isLivePr, summarize } from './sessionSummary';
import { computeProgress } from './progress';
import type { Exercise } from '../../../domain/exercise';
import type { LiveExercise } from '../../../domain/live-session';
import type { HistorySession } from '../../../domain/progression';
import type { SetRow } from '../../../domain/session';
import type { Workout } from '../../../domain/types';

const MIN = 60_000;
const bench = {
  id: 'bench',
  name: 'Bench',
  primaryMuscles: ['chest'],
  secondaryMuscles: ['triceps'],
  equipment: 'dumbbell',
  requires: ['dumbbell'],
  mode: 'reps',
  muscles: { primary: ['chest'], secondary: ['triceps'] },
} as unknown as Exercise;
const plank = { id: 'plank', name: 'Plank', primaryMuscles: ['abdominals'], secondaryMuscles: [], equipment: 'bodyweight', requires: [], mode: 'time', muscles: { primary: ['abs'], secondary: [] } } as unknown as Exercise;
const pushup = { id: 'pu', name: 'Push-Up', primaryMuscles: ['chest'], secondaryMuscles: [], equipment: 'bodyweight', requires: [], mode: 'reps', muscles: { primary: ['chest'], secondary: [] } } as unknown as Exercise;
const byId = (id: string) => [bench, plank, pushup].find((e) => e.id === id);

const set = (w: number, r: number): SetRow => ({ w, r, done: true, phase: 'work', at: 0 });
const workout = (id: string, start: number, entries: Workout['entries']): Workout => ({ id, start, end: start + 45 * MIN, entries });
const entry = (exerciseId: string, sets: SetRow[]) => ({ exerciseId, planned: { w: 8, reps: 10, sets: 3 }, sets });
const live = (sets: SetRow[], mode: 'reps' | 'time' = 'reps'): LiveExercise => ({ exerciseId: 'bench', mode, prescription: { w: 8, reps: 10, sets: 3 }, sets });
const hist = (...w: number[]): HistorySession[] => w.map((x, i) => ({ date: i, target: { w: x, reps: 10, sets: 3 }, sets: [set(x, 10)] }));

describe('isLivePr', () => {
  it('is true only for a weight strictly above the previous best', () => {
    const le = live([set(8, 10), set(10, 10)]);
    expect(isLivePr(le, hist(8), 0)).toBe(false);
    expect(isLivePr(le, hist(8), 1)).toBe(true);
  });
  it('is false when there is no history: the first lift of an exercise is not a record', () => {
    expect(isLivePr(live([set(10, 10)]), [], 0)).toBe(false);
  });
  it('is false for a timed set and for weight 0', () => {
    expect(isLivePr(live([set(10, 30)], 'time'), hist(8), 0)).toBe(false);
    expect(isLivePr(live([set(0, 10)]), hist(8), 0)).toBe(false);
  });
});

const base = { exerciseById: byId, bodyweight: [], daysPerWeek: 3, repMaxFor: () => 10, now: 10 * 86_400_000 };

describe('summarize', () => {
  const w1 = workout('w1', 1_000_000_000, [entry('bench', [set(8, 10), set(8, 10), set(8, 10)])]);
  const w2 = workout('w2', 1_000_000_000 + 7 * 86_400_000, [entry('bench', [set(10, 10), set(10, 10), set(10, 10)]), entry('plank', [set(0, 45)])]);

  it('reports minutes and volume (timed sets are not volume)', () => {
    const s = summarize({ ...base, workouts: [], workout: w2 });
    expect(s.minutes).toBe(45);
    expect(s.volumeKg).toBe(300);
  });

  it('lists an exercise that beat its best, and not the first-ever lift', () => {
    expect(summarize({ ...base, workouts: [w1], workout: w2 }).prExerciseIds).toEqual(['bench']);
    expect(summarize({ ...base, workouts: [], workout: w1 }).prExerciseIds).toEqual([]);
  });

  it('xp is what the Progress maths gives with the workout minus without it', () => {
    const before = computeProgress({ ...base, workouts: [w1] });
    const after = computeProgress({ ...base, workouts: [w1, w2] });
    const s = summarize({ ...base, workouts: [w1], workout: w2 });
    expect(s.xpByGroup.chest).toBeCloseTo(after.muscles.chest.xp - before.muscles.chest.xp);
    expect(s.xpTotal).toBeGreaterThan(0);
  });

  it('a first session has xp from its sets and no rank-ups', () => {
    const s = summarize({ ...base, workouts: [], workout: w1 });
    expect(s.xpTotal).toBeGreaterThan(0);
    expect(s.rankUps).toEqual([]);
  });

  it('a session with no sets of anything known has xp 0 and no crash', () => {
    const s = summarize({ ...base, workouts: [], workout: workout('w0', 0, [entry('gone', [set(8, 10)])]) });
    expect(s.xpTotal).toBe(0);
  });

  it('muscles hit are the union of the logged exercises', () => {
    const s = summarize({ ...base, workouts: [], workout: w2 });
    expect([...s.primary].sort()).toEqual(['abs', 'chest']);
    expect(s.secondary).toEqual(['triceps']);
  });

  it('says when bodyweight sets were scored with the default bodyweight', () => {
    const pu = workout('wp', 1_000_000_000, [entry('pu', [set(0, 10)])]);
    expect(summarize({ ...base, workouts: [], workout: pu }).usedDefaultBodyweight).toBe(true);
    const bw = [{ date: new Date(1_000_000_000).toISOString().slice(0, 10), kg: 80 }];
    expect(summarize({ ...base, bodyweight: bw, workouts: [], workout: pu }).usedDefaultBodyweight).toBe(false);
    expect(summarize({ ...base, workouts: [], workout: workout('wb', 1_000_000_000, [entry('bench', [set(8, 10)])]) }).usedDefaultBodyweight).toBe(false);
  });
});
