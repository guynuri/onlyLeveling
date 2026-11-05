import { describe, it, expect } from 'vitest';
import { e1rm, isRecordE1RM } from './onerm';

describe('e1rm (Epley, sets of 12 reps or fewer)', () => {
  it('returns a value at 12 reps', () => {
    expect(e1rm(20, 12)).toBeCloseTo(20 * (1 + 12 / 30));
  });

  it('returns null at 13 reps and above', () => {
    expect(e1rm(20, 13)).toBeNull();
    expect(e1rm(20, 30)).toBeNull();
  });

  it('uses weight and reps only, and returns null for non-positive input', () => {
    expect(e1rm(0, 5)).toBeNull();
    expect(e1rm(20, 0)).toBeNull();
    expect(e1rm(20, 1)).toBeCloseTo(20 * (1 + 1 / 30));
  });
});

describe('isRecordE1RM', () => {
  it('is a record only when strictly above every value in history', () => {
    const history = [30, 32];
    expect(isRecordE1RM(33, history)).toBe(true);
    expect(isRecordE1RM(32, history)).toBe(false);
    expect(isRecordE1RM(31, history)).toBe(false);
  });

  it('empty history: any non-null value is a record', () => {
    expect(isRecordE1RM(10, [])).toBe(true);
    expect(isRecordE1RM(null, [])).toBe(false);
  });
});
