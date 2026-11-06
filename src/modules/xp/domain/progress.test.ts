import { describe, it, expect } from 'vitest';
import { computeProgress } from './progress';
import type { Exercise } from '../../../domain/exercise';
import type { Workout, BodyweightEntry } from '../../../domain/types';
import type { SetRow } from '../../../domain/session';

const bench: Exercise = {
  id: 'fx_Dumbbell_Bench_Press',
  name: 'Dumbbell Bench Press',
  aliases: [],
  equipment: 'dumbbell',
  force: 'push',
  mechanic: 'compound',
  level: null,
  category: 'strength',
  primaryMuscles: ['chest'],
  secondaryMuscles: ['shoulders', 'triceps'],
  movementPattern: 'push',
  instructions: [],
  requires: [],
  mode: 'reps',
  muscles: { primary: [], secondary: [] },
  source: 'free-exercise-db',
  textSource: 'free-exercise-db',
  license: 'Unlicense',
  author: null,
  sourceUrl: null,
};
const catalogue = new Map([[bench.id, bench]]);
const exerciseById = (id: string) => catalogue.get(id);

const DAY = 86_400_000;
// Monday 2 Nov 2026 is far enough back for a 12-week run that ends on 'now'.
const START = new Date(2026, 10, 2, 10).getTime();
const NOW = START + 12 * 7 * DAY;

const sets = (w: number, reps: number, n = 3): SetRow[] =>
  Array.from({ length: n }, () => ({ w, r: reps, done: true, phase: 'work' as const, at: 0 }));

// One benchmark session: 3 sets of 10 at `w`, planned 3 × 10.
const session = (id: string, start: number, w: number, reps = 10): Workout => ({
  id,
  start,
  end: start + 3_600_000,
  entries: [{ exerciseId: bench.id, planned: { w, reps, sets: 3 }, sets: sets(w, reps) }],
});

const input = (workouts: Workout[], bodyweight: BodyweightEntry[] = [{ date: '2026-11-02', kg: 80 }]) => ({
  workouts,
  exerciseById,
  bodyweight,
  daysPerWeek: 3,
  repMaxFor: () => 10,
  now: NOW,
});

describe('a 12-week run', () => {
  it('three sessions a week, weight rising: chest stays below B', () => {
    const workouts: Workout[] = [];
    for (let week = 0; week < 12; week++) {
      const w = week < 6 ? 16 : week < 9 ? 18 : 20;
      for (const d of [0, 2, 4]) {
        const start = START + (week * 7 + d) * DAY;
        workouts.push(session(`w${week}-${d}`, start, w));
      }
    }
    const p = computeProgress(input(workouts));
    expect(p.muscles.chest.xp).toBeGreaterThan(30_000); // about 43k on these numbers: the scale is in the thousands
    expect(['F', 'E', 'D', 'C']).toContain(p.muscles.chest.rank);
    expect(p.streak).toBeGreaterThan(0);
  });
});

const oneArm: Exercise = {
  ...bench,
  id: 'fx_One-Arm_Dumbbell_Row',
  name: 'One-Arm Dumbbell Row',
  primaryMuscles: ['middle back'],
  secondaryMuscles: [],
};
const bothLifts = new Map([
  [bench.id, bench],
  [oneArm.id, oneArm],
]);
const lift = (id: string, start: number, w: number, reps = 10): Workout => ({
  id: `${id}-${start}`,
  start,
  end: start + 3_600_000,
  entries: [{ exerciseId: id, planned: { w, reps, sets: 3 }, sets: sets(w, reps) }],
});

describe('strength rank, end to end through computeProgress', () => {
  const both = { exerciseById: (id: string) => bothLifts.get(id), repMaxFor: () => 10, now: NOW };

  it('two bench sessions at 18 kg each (bells counted), against 80 kg bodyweight, give D', () => {
    // e1RM(18, 10) = 24 per bell, × 2 bells = 48; 48 ÷ 80 = 0.6, which meets D (0.5) and not C (0.75)
    const p = computeProgress({
      ...both,
      workouts: [lift(bench.id, START, 18), lift(bench.id, START + 7 * DAY, 18)],
      bodyweight: [{ date: '2026-11-02', kg: 80 }],
      daysPerWeek: 3,
    });
    expect(p.muscles.chest.strength).toBe('D');
    // Two sessions are far below the E volume threshold, so the lower of the two (volume F) is the rank.
    expect(p.muscles.chest.rank).toBe('F');
  });

  it('a one-arm lift counts one bell: 20 kg row against 80 kg gives E, not C', () => {
    // e1RM(20, 10) = 26.7, one bell: 0.33 meets E (0.3); two bells would give 0.67 and C
    const p = computeProgress({
      ...both,
      workouts: [lift(oneArm.id, START, 20), lift(oneArm.id, START + 7 * DAY, 20)],
      bodyweight: [{ date: '2026-11-02', kg: 80 }],
      daysPerWeek: 3,
    });
    expect(p.muscles.back.strength).toBe('E');
  });

  it('bodyweight older than the window does not count: strength stays F', () => {
    // The only entry is 8 days before the first session, outside the 7-day window
    const p = computeProgress({
      ...both,
      workouts: [lift(bench.id, START, 18), lift(bench.id, START + 7 * DAY, 18)],
      bodyweight: [{ date: '2026-10-25', kg: 80 }],
      daysPerWeek: 3,
    });
    expect(p.muscles.chest.strength).toBe('F');
  });
});

describe('rules inside the computation', () => {
  it('without any bodyweight entry, every muscle stays at F', () => {
    const p = computeProgress(input([session('a', START, 20)], []));
    expect(p.muscles.chest.xp).toBeGreaterThan(0);
    expect(p.muscles.chest.rank).toBe('F');
  });

  it('the first lift of an exercise is not a personal record; a heavier one later is', () => {
    expect(computeProgress(input([session('a', START, 16)])).badges).not.toContain('pr:first');
    const later = computeProgress(input([session('a', START, 16), session('b', START + 7 * DAY, 18)]));
    expect(later.badges).toContain('pr:first');
  });

  it('a set above 30 reps is flagged and earns nothing', () => {
    const odd: Workout = {
      id: 'odd',
      start: START,
      end: START,
      entries: [{ exerciseId: bench.id, planned: { w: 10, reps: 10, sets: 1 }, sets: [{ w: 10, r: 31, done: true, phase: 'work', at: 0 }] }],
    };
    const p = computeProgress(input([odd]));
    expect(p.flaggedSets).toBe(1);
    expect(p.muscles.chest.xp).toBe(0);
  });

  it('one session earns the first-session badge, not the ten-session one', () => {
    const p = computeProgress(input([session('a', START, 16)]));
    expect(p.badges).toContain('session:1');
    expect(p.badges).not.toContain('session:10');
  });
});
