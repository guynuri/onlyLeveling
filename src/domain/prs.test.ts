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

  it('warm-up sets never count toward the best weight or a PR', () => {
    const warm = { w: 20, r: 3, done: true, phase: 'warmup' as const, at: 1 };
    const h: HistorySession[] = [
      { date: 1, target: { w: 10, reps: 8, sets: 1 }, sets: [warm, { w: 10, r: 8, done: true, phase: 'work', at: 1 }] },
    ];
    expect(bestWeight(h)).toBe(10);
    expect(isNewWeightPR(12, h)).toBe(true);
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
