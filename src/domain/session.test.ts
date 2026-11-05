import { describe, it, expect } from 'vitest';
import { isHit } from './session';

describe('isHit', () => {
  it('a set is a hit when done at or above the target reps', () => {
    expect(isHit({ w: 8, r: 10, done: true, phase: 'work', at: 0 }, 10)).toBe(true);
    expect(isHit({ w: 8, r: 11, done: true, phase: 'work', at: 0 }, 10)).toBe(true);
  });

  it('a set below the target reps is a miss', () => {
    expect(isHit({ w: 8, r: 9, done: true, phase: 'work', at: 0 }, 10)).toBe(false);
  });

  it('a set not done is a miss, whatever the reps', () => {
    expect(isHit({ w: 8, r: 12, done: false, phase: 'work', at: 0 }, 10)).toBe(false);
  });
});
