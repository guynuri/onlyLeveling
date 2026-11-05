import { describe, it, expect } from 'vitest';
import { createRepoCache, historyFor, progressionConfigFor, repRangeFor } from './data';
import type { Workout } from '../../domain/types';
import type { Exercise } from '../../domain/exercise';

const ex = (over: Partial<Exercise>): Exercise => ({
  id: 'fx_a',
  name: 'a',
  aliases: [],
  equipment: 'dumbbell',
  force: 'push',
  mechanic: 'compound',
  level: 'beginner',
  category: 'strength',
  primaryMuscles: [],
  secondaryMuscles: [],
  movementPattern: 'push',
  instructions: [],
  source: 'free-exercise-db',
  textSource: 'free-exercise-db',
  license: 'Unlicense',
  author: null,
  sourceUrl: null,
  ...over,
});

const W = (id: string, start: number, exerciseId: string): Workout => ({
  id,
  start,
  end: start + 1,
  entries: [
    {
      exerciseId,
      planned: { w: 8, reps: 8, sets: 3 },
      sets: [{ w: 8, r: 8, done: true, phase: 'work', at: start }],
    },
  ],
});

describe('historyFor', () => {
  it('keeps only sessions with this exercise, oldest first', () => {
    const ws = [W('w3', 300, 'fx_a'), W('w1', 100, 'fx_a'), W('w2', 200, 'fx_b')];
    expect(historyFor(ws, 'fx_a').map((h) => h.date)).toEqual([100, 300]);
  });
});

describe('repo handle cache', () => {
  it('a failed open is not cached: the next call tries again', async () => {
    let attempts = 0;
    const { get } = createRepoCache(async () => {
      attempts++;
      if (attempts === 1) throw new Error('transient');
      return {} as never;
    });
    await expect(get()).rejects.toThrow('transient');
    await expect(get()).resolves.toBeDefined();
    expect(attempts).toBe(2);
  });

  it('a successful open is cached and reused', async () => {
    let attempts = 0;
    const { get } = createRepoCache(async () => {
      attempts++;
      return {} as never;
    });
    await get();
    await get();
    expect(attempts).toBe(1);
  });
});

describe('progression wiring', () => {
  it('compound lifts use the compound rep range, isolation and unknown use the isolation range', () => {
    expect(repRangeFor(ex({ mechanic: 'compound' }))).toEqual({ min: 6, max: 10 });
    expect(repRangeFor(ex({ mechanic: 'isolation' }))).toEqual({ min: 10, max: 15 });
    expect(repRangeFor(ex({ mechanic: null }))).toEqual({ min: 10, max: 15 });
  });

  it('config carries the owned list straight through', () => {
    const cfg = progressionConfigFor(ex({}), [4, 6]);
    expect(cfg.owned).toEqual([4, 6]);
    expect(cfg.repMin).toBe(6);
  });
});
