import { describe, it, expect } from 'vitest';
import { BODY_SLUGS } from '../../../domain/muscle-map';
import type { Workout } from '../../../domain/types';
import { GROUPS } from './muscles';
import { GROUP_SLUGS, rankNote, exercisesFor, groupOfSlug, levelOf, recoveryOf, weightTrend, xpToNextRank } from './hub';

const DAY = 86_400_000;
const NOW = new Date(2026, 10, 7, 12).getTime();
const muscles: Record<string, string[]> = { bench: ['chest'], row: ['middle back'], curl: ['biceps'] };
const byId = (id: string) => (muscles[id] ? { primaryMuscles: muscles[id] } : undefined);
const workout = (start: number, ids: string[], done = true): Workout => ({
  id: String(start),
  start,
  end: start + 3_600_000,
  entries: ids.map((exerciseId) => ({
    exerciseId,
    planned: { w: 10, reps: 10, sets: 1 },
    sets: [{ w: 10, r: 10, done, phase: 'work' as const, at: start }],
  })),
});

describe('GROUP_SLUGS', () => {
  it('puts every drawn muscle in exactly one group', () => {
    const all = GROUPS.flatMap((g) => GROUP_SLUGS[g]);
    expect([...all].sort()).toEqual([...BODY_SLUGS].sort());
    for (const g of GROUPS) for (const s of GROUP_SLUGS[g]) expect(groupOfSlug(s)).toBe(g);
  });
});

describe('levelOf', () => {
  it('starts at level 1 and grows by (L−1)² × 2000', () => {
    expect(levelOf(0)).toEqual({ level: 1, into: 0, span: 2000 });
    expect(levelOf(1999).level).toBe(1);
    expect(levelOf(2000)).toEqual({ level: 2, into: 0, span: 6000 });
    expect(levelOf(8000)).toEqual({ level: 3, into: 0, span: 10000 });
    expect(levelOf(-5).level).toBe(1);
  });
});

describe('xpToNextRank', () => {
  it('names the next rank and the XP left, null at the top', () => {
    expect(xpToNextRank(0)).toEqual({ next: 'E', need: 5000 });
    expect(xpToNextRank(5000)).toEqual({ next: 'D', need: 10000 });
    expect(xpToNextRank(1e9)).toBeNull();
  });
});

describe('recoveryOf', () => {
  it('recovering inside 48 h, ready after, neglected from 10 days or never', () => {
    const r = recoveryOf([workout(NOW - 47 * 3_600_000, ['bench']), workout(NOW - 3 * DAY, ['row']), workout(NOW - 10 * DAY, ['curl'])], byId, NOW);
    expect(r.chest).toBe('recovering');
    expect(r.back).toBe('ready');
    expect(r.biceps).toBe('neglected');
    expect(r.quads).toBe('neglected');
  });
  it('uses the latest session and ignores sets not done', () => {
    const r = recoveryOf([workout(NOW - 20 * DAY, ['bench']), workout(NOW - 5 * DAY, ['bench']), workout(NOW - DAY, ['bench'], false)], byId, NOW);
    expect(r.chest).toBe('ready');
  });
});

describe('exercisesFor', () => {
  it('lists exercises that train the group, most sessions first', () => {
    const ws = [workout(1, ['bench', 'row']), workout(2, ['row']), workout(3, ['curl'])];
    expect(exercisesFor('back', ws, byId)).toEqual(['row']);
    expect(exercisesFor('quads', ws, byId)).toEqual([]);
  });
});

describe('weightTrend', () => {
  it('averages the entries in the 7 days ending on each one', () => {
    const t = weightTrend([
      { date: '2026-11-08', kg: 82 },
      { date: '2026-11-01', kg: 80 },
      { date: '2026-11-02', kg: 81 },
    ]);
    expect(t.map((p) => p.date)).toEqual(['2026-11-01', '2026-11-02', '2026-11-08']);
    expect(t[1].avg).toBe(80.5);
    expect(t[2].avg).toBe(81.5); // 11-01 is 7 days back: out of the window
  });
});

describe('rankNote', () => {
  it('explains a rank held back by strength or missing bodyweight', () => {
    expect(rankNote({ xp: 16000, rank: 'D', strength: 'D' }, 80)).toBeNull();
    expect(rankNote({ xp: 16000, rank: 'F', strength: null }, null)).toBe('Volume says D. Log your bodyweight to unlock ranks.');
    expect(rankNote({ xp: 16000, rank: 'F', strength: 'F' }, 80)).toBe(
      'Volume says D, strength holds it at F. For E: reach an estimated max of 24 kg (both dumbbells) on the benchmark lift in 2 sessions.',
    );
    expect(rankNote({ xp: 16000, rank: 'F', strength: 'F' }, 81.4)).toContain('25 kg'); // 0.3 × 81.4 = 24.42, rounded up
    expect(rankNote({ xp: 1e9, rank: 'SSS', strength: 'SSS' }, 80)).toBeNull();
  });
});
