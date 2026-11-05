import { describe, it, expect } from 'vitest';
import { bestWeight, isNewWeightPR } from './prs';
import type { HistorySession } from './progression';

const s = (date: number, ws: number[]): HistorySession => ({
  date,
  target: { w: 0, reps: 8, sets: ws.length },
  sets: ws.map((w) => ({ w, r: 8, done: true, phase: 'work', at: date })),
});

describe('PRs', () => {
  it('bestWeight is the heaviest done set across history', () => {
    expect(bestWeight([s(1, [10, 12]), s(2, [11])])).toBe(12);
    expect(bestWeight([])).toBeNull();
  });

  it('a new weight PR only when strictly above history', () => {
    const history = [s(1, [10]), s(2, [12])];
    expect(isNewWeightPR(13, history)).toBe(true);
    expect(isNewWeightPR(12, history)).toBe(false);
  });

  it('the current session is excluded by the caller: history must not contain it', () => {
    const current = s(3, [20]);
    const history = [s(1, [10])];
    // Judged against history only: 20 beats 10, so it is a PR; if the current session were
    // wrongly included, the comparison would still say 20 is not above itself.
    expect(isNewWeightPR(20, history)).toBe(true);
    expect(isNewWeightPR(20, [...history, current])).toBe(false);
  });
});
