import { describe, it, expect } from 'vitest';
import { buildLive, canFinish, currentPosition, logSet, nextSetDefaults, rateSet, ratingOf, setRir, toEntries, undoLastSet, type LiveExercise } from './live-session';
import type { Exercise } from './exercise';

const ex = (id: string, mode: 'reps' | 'time' = 'reps') => ({ id, mode }) as Exercise;
const le = (over: Partial<LiveExercise> = {}): LiveExercise => ({
  exerciseId: 'a',
  mode: 'reps',
  prescription: { w: 8, reps: 10, sets: 3 },
  sets: [],
  ...over,
});

describe('buildLive', () => {
  it('skips an exercise the catalogue no longer has', () => {
    const out = buildLive([
      { exercise: ex('a'), prescription: { w: 8, reps: 10, sets: 3 } },
      { exercise: undefined, prescription: { w: 8, reps: 10, sets: 3 } },
      { exercise: ex('t', 'time'), prescription: { w: 0, reps: 30, sets: 2 } },
    ]);
    expect(out.map((e) => [e.exerciseId, e.mode])).toEqual([
      ['a', 'reps'],
      ['t', 'time'],
    ]);
    expect(out[0].sets).toEqual([]);
  });
});

describe('nextSetDefaults', () => {
  it('starts from the prescription, then repeats the last logged set', () => {
    expect(nextSetDefaults(le())).toEqual({ w: 8, r: 10 });
    const logged = logSet(le(), { w: 10, r: 8 }, 1);
    expect(nextSetDefaults(logged)).toEqual({ w: 10, r: 8 });
  });
});

describe('logSet', () => {
  it('appends a done work set with the time given', () => {
    const out = logSet(le(), { w: 8, r: 10 }, 123);
    expect(out.sets).toEqual([{ w: 8, r: 10, done: true, phase: 'work', at: 123 }]);
  });
  it('does not change the input', () => {
    const start = le();
    logSet(start, { w: 8, r: 10 }, 1);
    expect(start.sets).toEqual([]);
  });
});

describe('setRir', () => {
  const one = logSet(le(), { w: 8, r: 10 }, 1);
  it('accepts 0 to 4', () => {
    expect(setRir(one, 0, 0).sets[0].rir).toBe(0);
    expect(setRir(one, 0, 4).sets[0].rir).toBe(4);
  });
  it('rejects 5, -1 and a set that does not exist', () => {
    expect(setRir(one, 0, 5)).toBe(one);
    expect(setRir(one, 0, -1)).toBe(one);
    expect(setRir(one, 3, 2)).toBe(one);
  });
  it('clears the value with undefined', () => {
    expect(setRir(setRir(one, 0, 2), 0, undefined).sets[0].rir).toBeUndefined();
  });
});

describe('undoLastSet', () => {
  it('removes only the last set', () => {
    const two = logSet(logSet(le(), { w: 8, r: 10 }, 1), { w: 8, r: 9 }, 2);
    expect(undoLastSet(two).sets.map((s) => s.r)).toEqual([10]);
  });
  it('is a no-op on an empty list', () => {
    const empty = le();
    expect(undoLastSet(empty)).toBe(empty);
  });
});

describe('currentPosition', () => {
  const a = le({ exerciseId: 'a', prescription: { w: 8, reps: 10, sets: 2 } });
  const b = le({ exerciseId: 'b', prescription: { w: 8, reps: 10, sets: 1 } });
  it('walks exercise by exercise, set by set', () => {
    expect(currentPosition([a, b])).toEqual({ exercise: 0, set: 0 });
    const a1 = logSet(a, { w: 8, r: 10 }, 1);
    expect(currentPosition([a1, b])).toEqual({ exercise: 0, set: 1 });
    const a2 = logSet(a1, { w: 8, r: 10 }, 2);
    expect(currentPosition([a2, b])).toEqual({ exercise: 1, set: 0 });
  });
  it('is null when every exercise has its sets', () => {
    const done = [logSet(logSet(a, { w: 8, r: 10 }, 1), { w: 8, r: 10 }, 2), logSet(b, { w: 8, r: 10 }, 3)];
    expect(currentPosition(done)).toBeNull();
  });
});

describe('toEntries and canFinish', () => {
  it('toEntries keeps only exercises with a logged set, with the plan as planned', () => {
    const logged = logSet(le({ exerciseId: 'a' }), { w: 8, r: 10 }, 1);
    const entries = toEntries([logged, le({ exerciseId: 'b' })]);
    expect(entries).toEqual([{ exerciseId: 'a', planned: { w: 8, reps: 10, sets: 3 }, sets: logged.sets }]);
  });
  it('canFinish refuses an empty session and accepts one with a set', () => {
    expect(canFinish([le()])).toEqual({ ok: false, error: 'Log at least one set first.' });
    expect(canFinish([logSet(le(), { w: 8, r: 10 }, 1)])).toEqual({ ok: true });
  });
});

describe('rateSet (effort scale -3 to 4+)', () => {
  const le: LiveExercise = { exerciseId: 'x', mode: 'reps', prescription: { w: 10, reps: 10, sets: 3 }, sets: [{ w: 10, r: 10, done: true, phase: 'work', at: 1 }] };
  it('0 to 4 is RIR and keeps the reps', () => {
    const r = rateSet(le, 0, 2).sets[0];
    expect(r).toMatchObject({ r: 10, rir: 2 });
    expect(r.missed).toBeUndefined();
  });
  it('below zero takes reps off, and moving back up restores them', () => {
    const missed = rateSet(le, 0, -2);
    expect(missed.sets[0]).toMatchObject({ r: 8, rir: 0, missed: 2 });
    expect(ratingOf(missed.sets[0])).toBe(-2);
    expect(rateSet(missed, 0, -3).sets[0]).toMatchObject({ r: 7, missed: 3 });
    expect(rateSet(missed, 0, 1).sets[0]).toMatchObject({ r: 10, rir: 1 });
    const cleared = rateSet(missed, 0, undefined).sets[0];
    expect(cleared.r).toBe(10);
    expect(cleared.rir).toBeUndefined();
  });
  it('ignores values off the scale and unknown sets', () => {
    expect(rateSet(le, 0, -4)).toBe(le);
    expect(rateSet(le, 0, 5)).toBe(le);
    expect(rateSet(le, 3, 1)).toBe(le);
    const two = { ...le, sets: [{ ...le.sets[0], r: 2 }] };
    expect(rateSet(two, 0, -2)).toBe(two); // would leave 0 reps
    expect(rateSet(two, 0, -1).sets[0].r).toBe(1);
  });
});
