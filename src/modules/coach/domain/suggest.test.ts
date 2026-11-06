import { describe, it, expect } from 'vitest';
import { reconcile, candidates, type Candidate } from './suggest';
import { suggestionId, type Suggestion } from '../../../domain/suggestion';
import { planFromTemplate, applySuggestion, activeAdjustment, deloadWeight } from '../../../domain/plan';
import type { Exercise } from '../../../domain/exercise';
import type { Workout } from '../../../domain/types';

const DAY = 86_400_000;
const NOW = 200 * DAY;

const cand = (over: Partial<Candidate> = {}): Candidate => ({
  rule: 'stall',
  exerciseId: 'ex1',
  reason: 'r',
  action: { kind: 'deload', w: 9 },
  lastLogged: NOW - DAY,
  ...over,
});
const stored = (over: Partial<Suggestion> = {}): Suggestion => ({
  id: suggestionId('stall', 'ex1'),
  rule: 'stall',
  exerciseId: 'ex1',
  reason: 'r',
  action: { kind: 'deload', w: 9 },
  createdAt: NOW - 5 * DAY,
  status: 'pending',
  ...over,
});

describe('reconcile: user decisions are respected', () => {
  it('shows a new candidate and saves it', () => {
    const r = reconcile([], [cand()], NOW);
    expect(r.cards).toHaveLength(1);
    expect(r.save).toHaveLength(1);
  });
  it('never comes back', () => {
    expect(reconcile([stored({ status: 'never' })], [cand()], NOW).cards).toHaveLength(0);
  });
  it('Not now hides it until the snooze ends, then shows it again', () => {
    const snoozed = stored({ status: 'snoozed', until: NOW + DAY });
    expect(reconcile([snoozed], [cand()], NOW).cards).toHaveLength(0);
    expect(reconcile([{ ...snoozed, until: NOW - 1 }], [cand()], NOW).cards).toHaveLength(1);
  });
  it('an accepted card stays hidden until a session is logged after the accept', () => {
    const acc = stored({ status: 'accepted', createdAt: NOW - DAY });
    expect(reconcile([acc], [cand({ lastLogged: NOW - 2 * DAY })], NOW).cards).toHaveLength(0);
    expect(reconcile([acc], [cand({ lastLogged: NOW - DAY / 2 })], NOW).cards).toHaveLength(1);
  });
  it('does not save an unchanged pending card again', () => {
    const r = reconcile([stored({ createdAt: NOW - 5 * DAY })], [cand({ reason: 'r' })], NOW);
    expect(r.cards).toHaveLength(1);
    expect(r.save).toHaveLength(0);
  });
});

describe('plan and actions', () => {
  const owned = [4, 6, 8, 10, 12, 14, 16];
  it('deload snaps to an owned bell and is always lighter', () => {
    expect(deloadWeight(12, owned, 0.9)).toBe(10); // 10.8 → 10
    expect(deloadWeight(4, owned, 0.9)).toBe(4); // nothing lighter → holds
  });
  it('an accepted weight adjustment is used until a session with the exercise is logged', () => {
    const plan = planFromTemplate([], 3, 0);
    const s = { ...stored(), action: { kind: 'jump' as const, w: 14 } };
    const next = applySuggestion(plan, s, 1000, owned);
    const logged: Workout = {
      id: 'w',
      start: 500,
      end: 600,
      entries: [{ exerciseId: 'ex1', planned: { w: 12, reps: 8, sets: 3 }, sets: [] }],
    };
    expect(activeAdjustment(next, 'ex1', [])).toBe(14);
    expect(activeAdjustment(next, 'ex1', [logged])).toBe(14); // logged before the accept: still waiting
    expect(activeAdjustment(next, 'ex1', [{ ...logged, start: 2000 }])).toBeNull();
  });
  it('a swap replaces the exercise in every plan day', () => {
    const plan = planFromTemplate(
      [
        { index: 0, warmup: [], exerciseIds: ['a', 'b'], cooldown: [] },
        { index: 1, warmup: [], exerciseIds: ['a'], cooldown: [] },
      ],
      2,
      0,
    );
    const next = applySuggestion(plan, { ...stored(), exerciseId: 'a', action: { kind: 'swap', toId: 'c' } }, 1, owned);
    expect(next.days.map((d) => d.exerciseIds)).toEqual([['c', 'b'], ['c']]);
  });
});

describe('candidates', () => {
  const ex = (id: string, muscle: string): Exercise =>
    ({
      id,
      name: id,
      aliases: [],
      equipment: 'dumbbell',
      force: 'push',
      mechanic: 'isolation',
      level: null,
      category: 'strength',
      primaryMuscles: [muscle],
      secondaryMuscles: [],
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
    }) as Exercise;
  it('a stale exercise gets a swap to a same-muscle variation, when one exists', () => {
    const plan = planFromTemplate([{ index: 0, warmup: [], exerciseIds: ['a'], cooldown: [] }], 1, 0);
    const workouts: Workout[] = [
      {
        id: 'w1',
        start: NOW - 60 * DAY,
        end: NOW - 60 * DAY,
        entries: [{ exerciseId: 'a', planned: { w: 8, reps: 8, sets: 1 }, sets: [{ w: 8, r: 8, done: true, phase: 'work', at: 0 }] }],
      },
    ];
    const cat = [ex('a', 'chest'), ex('b', 'chest')];
    const out = candidates({ now: NOW, plan, owned: [8], catalogue: cat, workouts, stored: [], repMaxFor: () => 15 });
    expect(out.map((c) => c.rule)).toContain('stale');
    expect(out.find((c) => c.rule === 'stale')?.action).toEqual({ kind: 'swap', toId: 'b' });
  });
  it('after an accepted deload, the next stall offers a swap, on the next load too', () => {
    const plan = planFromTemplate([{ index: 0, warmup: [], exerciseIds: ['a'], cooldown: [] }], 1, 0);
    const set = { w: 8, r: 8, done: true, phase: 'work' as const, at: 0 };
    const session = (daysAgo: number) => ({
      id: `w${daysAgo}`,
      start: NOW - daysAgo * DAY,
      end: NOW - daysAgo * DAY,
      entries: [{ exerciseId: 'a', planned: { w: 8, reps: 8, sets: 1 }, sets: [set] }],
    });
    const workouts: Workout[] = [session(40), session(5), session(2)];
    const cat = [ex('a', 'chest'), ex('b', 'chest')];
    const tried: Suggestion = {
      id: 'stall:a',
      rule: 'stall',
      exerciseId: 'a',
      reason: 'r',
      action: { kind: 'deload', w: 7 },
      createdAt: NOW - 10 * DAY,
      status: 'accepted',
      deloadTried: true,
    };
    const first = candidates({ now: NOW, plan, owned: [8], catalogue: cat, workouts, stored: [tried], repMaxFor: () => 12 });
    expect(first.find((c) => c.rule === 'stall')?.action).toEqual({ kind: 'swap', toId: 'b' });
    // The card comes back and is saved; the flag must survive, so the next load still offers the swap.
    const saved = reconcile([tried], first, NOW).save.find((s) => s.id === 'stall:a')!;
    const second = candidates({ now: NOW, plan, owned: [8], catalogue: cat, workouts, stored: [saved], repMaxFor: () => 12 });
    expect(second.find((c) => c.rule === 'stall')?.action).toEqual({ kind: 'swap', toId: 'b' });
  });
});

describe('deload tried survives later saves', () => {
  it('a stall card that comes back after an accepted deload is saved still marked, so the next stall offers a swap', () => {
    const accepted: Suggestion = { ...stored(), status: 'accepted', createdAt: NOW - DAY, deloadTried: true };
    const r = reconcile([accepted], [cand({ lastLogged: NOW - DAY / 2 })], NOW);
    expect(r.save).toHaveLength(1);
    expect(r.save[0]).toMatchObject({ status: 'pending', deloadTried: true });
  });

  it('a deload accepted for the first time is not marked until it is accepted', () => {
    const r = reconcile([], [cand()], NOW);
    expect(r.save[0].deloadTried).toBeUndefined();
  });
});
