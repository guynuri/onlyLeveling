import { describe, it, expect } from 'vitest';
import { stepValue } from './stepper';

const owned = [4, 6, 8, 12];

describe('stepValue', () => {
  it('moves to the next owned weight', () => {
    expect(stepValue(6, 1, { values: owned })).toBe(8);
    expect(stepValue(8, -1, { values: owned })).toBe(6);
  });
  it('stays put at the ends of the owned list', () => {
    expect(stepValue(12, 1, { values: owned })).toBe(12);
    expect(stepValue(4, -1, { values: owned })).toBe(4);
  });
  it('uses the numeric step when there is no owned list', () => {
    expect(stepValue(10, 1, { step: 2.5 })).toBe(12.5);
    expect(stepValue(10, -1, { values: [] })).toBe(9);
  });
  it('never goes below min', () => {
    expect(stepValue(0, -1, {})).toBe(0);
    expect(stepValue(5, -1, { step: 10, min: 1 })).toBe(1);
  });
  it('never goes above max', () => {
    expect(stepValue(7, 1, { min: 1, max: 7 })).toBe(7);
    expect(stepValue(1, -1, { min: 1, max: 7 })).toBe(1);
  });
});
