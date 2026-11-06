import { describe, it, expect } from 'vitest';
import { nextPrescription, type HistorySession, type Prescription, type ProgressionConfig } from './progression';
import type { SetRow } from './session';

const CFG: ProgressionConfig = {
  repMin: 8,
  repMax: 12,
  sets: 3,
  owned: [4, 6, 8, 10, 12, 14],
  gridStep: 2,
  startWeight: 6,
};

const set = (w: number, r: number, done = true): SetRow => ({ w, r, done, phase: 'work', at: 0 });
const session = (date: number, w: number, reps: number[], target: Prescription): HistorySession => ({
  date,
  target,
  sets: reps.map((r) => set(w, r)),
});

describe('nextPrescription: first session', () => {
  it('no history starts at the bottom of the range on the starting bell', () => {
    expect(nextPrescription([], CFG)).toEqual({ w: 6, reps: 8, sets: 3 });
  });
});

describe('nextPrescription: double progression', () => {
  const base: Prescription = { w: 8, reps: 8, sets: 3 };

  it('all working sets hit the target: reps go up one inside the range', () => {
    const h = [session(1, 8, [8, 8, 8], base)];
    expect(nextPrescription(h, CFG)).toEqual({ w: 8, reps: 9, sets: 3 });
  });

  it('all sets at the top of the range: weight to the next owned bell, reps reset to the bottom', () => {
    const top: Prescription = { w: 8, reps: 12, sets: 3 };
    const h = [session(1, 8, [12, 12, 12], top)];
    expect(nextPrescription(h, CFG)).toEqual({ w: 10, reps: 8, sets: 3 });
  });

  it('a missed set keeps the weight and the target', () => {
    const h = [session(1, 8, [8, 7, 8], base)];
    expect(nextPrescription(h, CFG)).toEqual({ w: 8, reps: 8, sets: 3 });
  });

  it('a set not done counts as a miss', () => {
    const h: HistorySession[] = [
      { date: 1, target: base, sets: [set(8, 8), set(8, 8), set(8, 8, false)] },
    ];
    expect(nextPrescription(h, CFG)).toEqual({ w: 8, reps: 8, sets: 3 });
  });

  it('only the first planned sets decide: extra sets never move the weight', () => {
    const top: Prescription = { w: 8, reps: 12, sets: 3 };
    const h = [session(1, 8, [12, 12, 12, 3, 3], top)];
    expect(nextPrescription(h, CFG)).toEqual({ w: 10, reps: 8, sets: 3 });
    const miss = [session(1, 8, [8, 8, 8, 1], base)];
    expect(nextPrescription(miss, CFG).w).toBe(8);
  });

  it('warm-up sets never decide the outcome', () => {
    // A warm-up at 2 reps is not a working set; the three work sets at 12 are all hits.
    const top: Prescription = { w: 8, reps: 12, sets: 3 };
    const warm: SetRow = { w: 4, r: 2, done: true, phase: 'warmup', at: 1 };
    const h: HistorySession[] = [{ date: 1, target: top, sets: [warm, set(8, 12), set(8, 12), set(8, 12)] }];
    expect(nextPrescription(h, CFG)).toEqual({ w: 10, reps: 8, sets: 3 });
  });

  it('weight never lands off the owned list', () => {
    const top: Prescription = { w: 12, reps: 12, sets: 3 };
    const h = [session(1, 12, [12, 12, 12], top)];
    const next = nextPrescription(h, CFG);
    expect(CFG.owned).toContain(next.w);
    expect(next.w).toBe(14);
  });

  it('with no owned list, the weight steps by the grid', () => {
    const cfg = { ...CFG, owned: [] };
    const top: Prescription = { w: 8, reps: 12, sets: 3 };
    const h = [session(1, 8, [12, 12, 12], top)];
    expect(nextPrescription(h, cfg)).toEqual({ w: 10, reps: 8, sets: 3 });
  });

  it('editing a logged set changes the next target with no drift (same history, same answer)', () => {
    const h1 = [session(1, 8, [12, 12, 12], { w: 8, reps: 12, sets: 3 })];
    const fixed = [session(1, 8, [12, 12, 11], { w: 8, reps: 12, sets: 3 })];
    expect(nextPrescription(h1, CFG)).toEqual(nextPrescription(h1, CFG));
    expect(nextPrescription(fixed, CFG).w).toBe(8);
  });
});

describe('nextPrescription: unweighted exercises (bands, bodyweight)', () => {
  const REPS_ONLY: ProgressionConfig = { ...CFG, owned: [], weighted: false };
  it('starts at the bottom of the range with no weight', () => {
    expect(nextPrescription([], REPS_ONLY)).toEqual({ w: 0, reps: 8, sets: 3 });
  });
  it('a hit below the top adds a rep', () => {
    const h = [session(1, 0, [8, 8, 8], { w: 0, reps: 8, sets: 3 })];
    expect(nextPrescription(h, REPS_ONLY)).toEqual({ w: 0, reps: 9, sets: 3 });
  });
  it('a hit at the top stays at the top: there is no heavier weight to move to', () => {
    const h = [session(1, 0, [12, 12, 12], { w: 0, reps: 12, sets: 3 })];
    expect(nextPrescription(h, REPS_ONLY)).toEqual({ w: 0, reps: 12, sets: 3 });
  });
});
