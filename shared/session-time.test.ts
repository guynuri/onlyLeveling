import { describe, it, expect } from 'vitest';
import { daySeconds, minutesOf, trimToBudget, workSeconds } from './session-time';
import { SESSION_TIME } from '../src/config/thresholds';

const R = SESSION_TIME.secondsPerRep;
const C = SESSION_TIME.changeoverSec;

describe('workSeconds', () => {
  it('reps take secondsPerRep each, a hold its seconds, one side at a time twice', () => {
    expect(workSeconds({ reps: 10 })).toBe(10 * R);
    expect(workSeconds({ reps: 60, timed: true })).toBe(60);
    expect(workSeconds({ reps: 10, unilateral: true })).toBe(20 * R);
    expect(workSeconds({ reps: 30, timed: true, unilateral: true })).toBe(60);
  });
});

describe('daySeconds', () => {
  it('an exercise is its sets, the rests between them and one changeover', () => {
    expect(daySeconds([{ id: 'a', sets: 3, reps: 10 }], [], 90)).toBe(3 * 10 * R + 2 * 90 + C);
  });
  it('a 3-minute hold counts as 3 minutes a set', () => {
    expect(daySeconds([{ id: 'p', sets: 2, reps: 180, timed: true }], [], 60)).toBe(2 * 180 + 60 + C);
  });
  it('a superset rests once per round and changes over once, so it is shorter than the same work apart', () => {
    const items = [
      { id: 'a', sets: 3, reps: 10 },
      { id: 'b', sets: 3, reps: 10 },
    ];
    const apart = daySeconds(items, [], 90);
    const together = daySeconds(items, [['a', 'b']], 90);
    expect(together).toBe(3 * (2 * 10 * R + SESSION_TIME.supersetSwitchSec) + 2 * 90 + C);
    expect(together).toBeLessThan(apart);
  });
  it('a superset member with fewer sets sits out the later rounds', () => {
    const t = daySeconds([{ id: 'a', sets: 3, reps: 10 }, { id: 'b', sets: 2, reps: 10 }], [['a', 'b']], 60);
    expect(t).toBe(2 * (20 * R + SESSION_TIME.supersetSwitchSec) + 10 * R + 2 * 60 + C);
  });
  it('a group with one member present counts as a plain exercise', () => {
    expect(daySeconds([{ id: 'a', sets: 3, reps: 10 }], [['a', 'gone']], 90)).toBe(daySeconds([{ id: 'a', sets: 3, reps: 10 }], [], 90));
  });
  it('minutesOf rounds up', () => {
    expect(minutesOf(61)).toBe(2);
    expect(minutesOf(120)).toBe(2);
  });
});

describe('trimToBudget', () => {
  const items = ['a', 'b', 'c', 'd', 'e'].map((id) => ({ id, sets: 3, reps: 10 }));
  const one = daySeconds([items[0]], [], 90);
  it('drops from the end until the day fits', () => {
    const { kept, dropped } = trimToBudget(items, [], 90, one * 3, () => false, 1);
    expect(kept.map((t) => t.id)).toEqual(['a', 'b', 'c']);
    expect(dropped.map((t) => t.id)).toEqual(['e', 'd']);
  });
  it('protected items go last', () => {
    const { kept } = trimToBudget(items, [], 90, one * 3, (t) => t.id === 'e' || t.id === 'd', 1);
    expect(kept.map((t) => t.id)).toEqual(['a', 'd', 'e']);
  });
  it('never goes below the minimum', () => {
    expect(trimToBudget(items, [], 90, 0, () => false, 3).kept).toHaveLength(3);
  });
  it('a day that fits is left alone', () => {
    expect(trimToBudget(items, [], 90, one * 10, () => false, 1).dropped).toEqual([]);
  });
});
