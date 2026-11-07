import { describe, it, expect } from 'vitest';
import { sessionXp, type SessionEntry } from './sessionXp';
import type { Exercise } from '../../../domain/exercise';
import type { SetRow } from '../../../domain/session';

const base = {
  aliases: [],
  force: 'push',
  mechanic: 'compound',
  level: null,
  category: 'strength',
  secondaryMuscles: [],
  movementPattern: 'push',
  instructions: [],
  muscles: { primary: [], secondary: [] },
} as const;
const pushup = { ...base, id: 'pu', name: 'Push-Up', equipment: 'bodyweight', requires: [], mode: 'reps', primaryMuscles: ['chest'] } as unknown as Exercise;
const plank = { ...base, id: 'pl', name: 'Plank', equipment: 'bodyweight', requires: [], mode: 'time', primaryMuscles: ['abdominals'] } as unknown as Exercise;
const curl = { ...base, id: 'cu', name: 'Curl', equipment: 'dumbbell', requires: ['dumbbell'], mode: 'reps', primaryMuscles: ['biceps'] } as unknown as Exercise;

const set = (w: number, r: number): SetRow => ({ w, r, done: true, phase: 'work', at: 0 });
const entry = (exercise: Exercise, sets: SetRow[], reps = 10): SessionEntry => ({ exercise, planned: { w: 0, reps, sets: 3 }, sets });
const run = (entries: SessionEntry[], bw: number | null) => sessionXp(entries, () => null, () => 10, bw);

describe('sessionXp: unweighted and timed work', () => {
  it('push-ups earn chest XP from the share of bodyweight', () => {
    const r = run([entry(pushup, [set(0, 10), set(0, 10), set(0, 10)])], 80);
    expect(r.byGroup.chest).toBeGreaterThan(0);
    // 52 kg × 10 reps × 3 sets, plus the top-of-range bonus
    expect(r.byGroup.chest).toBeCloseTo(52 * 10 * 3 + 150);
  });

  it('a plank held 45 seconds earns nothing, though 45 looks like reps', () => {
    const r = run([entry(plank, [set(0, 45), set(0, 45)], 30)], 80);
    expect(r.byGroup.core).toBe(0);
    expect(r.flaggedSets).toBe(0);
  });

  it('dumbbell work still uses the weight entered', () => {
    const r = run([entry(curl, [set(10, 10), set(10, 10), set(10, 10)])], 80);
    expect(r.byGroup.biceps).toBeCloseTo(10 * 2 * 10 * 3 + 150);
  });

  it('says when the default bodyweight was used', () => {
    expect(run([entry(pushup, [set(0, 10)])], null).usedDefaultBodyweight).toBe(true);
    expect(run([entry(pushup, [set(0, 10)])], 80).usedDefaultBodyweight).toBe(false);
    expect(run([entry(curl, [set(10, 10)])], null).usedDefaultBodyweight).toBe(false);
  });
});
