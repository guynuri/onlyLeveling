import { describe, it, expect } from 'vitest';
import { creditedReps, setXp } from './setXp';
import type { SetRow } from '../../../domain/session';

const work = (w: number, r: number): SetRow => ({ w, r, done: true, phase: 'work', at: 0 });

describe('set XP', () => {
  it('below target earns 0', () => {
    expect(setXp(work(10, 7), 8, 2, null).xp).toBe(0);
  });

  it('at target earns load × target reps (both bells)', () => {
    expect(setXp(work(10, 8), 8, 2, null).xp).toBe(10 * 2 * 8);
  });

  it('one-arm work counts one bell', () => {
    expect(setXp(work(10, 8), 8, 1, null).xp).toBe(10 * 8);
  });

  it('each extra rep earns strictly less than the one before', () => {
    const gains = [];
    for (let r = 8; r <= 20; r++) gains.push(creditedReps(r + 1, 8).credited - creditedReps(r, 8).credited);
    for (let i = 1; i < gains.length; i++) expect(gains[i]).toBeLessThan(gains[i - 1]);
  });

  it('above 30 reps earns 0 and is flagged', () => {
    expect(setXp(work(5, 31), 8, 2, null)).toEqual({ xp: 0, flagged: true });
  });

  it('a set below the recent best earns w/best of its XP', () => {
    // 15 kg each × 2 bells × 10 reps = 300, times 15/20 = 225
    expect(setXp(work(15, 10), 10, 2, 20).xp).toBeCloseTo(225);
  });

  it('the weight-drop factor never goes below the floor', () => {
    // 10/40 = 0.25 is under the 0.5 floor: 10 × 2 × 10 × 0.5 = 100
    expect(setXp(work(10, 10), 10, 2, 40).xp).toBeCloseTo(100);
  });

  it('warm-up sets and undone sets earn 0', () => {
    expect(setXp({ ...work(10, 10), phase: 'warmup' }, 8, 2, null).xp).toBe(0);
    expect(setXp({ ...work(10, 10), done: false }, 8, 2, null).xp).toBe(0);
  });
});
