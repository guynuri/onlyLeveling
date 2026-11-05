import { describe, it, expect } from 'vitest';
import { volumeRank, strengthRank, muscleRank } from './rank';

describe('volume rank', () => {
  it('follows the XP thresholds', () => {
    expect(volumeRank(0)).toBe('F');
    expect(volumeRank(4_999)).toBe('F');
    expect(volumeRank(5_000)).toBe('E');
    expect(volumeRank(70_000)).toBe('B');
    expect(volumeRank(10_000_000)).toBe('SSS');
  });
});

describe('strength rank', () => {
  it('one lucky session does not count', () => {
    expect(strengthRank([1.3])).toBe('F');
  });

  it('two separate sessions at a multiple count', () => {
    // 1.2 meets B (1.0) on two sessions; A (1.25) on none
    expect(strengthRank([1.2, 1.2])).toBe('B');
  });
});

describe('muscle rank', () => {
  it('is the lower of volume and strength', () => {
    expect(muscleRank(70_000, 'C', true)).toBe('C');
    expect(muscleRank(15_000, 'S', true)).toBe('D');
  });

  it('with no bodyweight on record, stays at F', () => {
    expect(muscleRank(500_000, 'SSS', false)).toBe('F');
  });

  it('a group without a benchmark ranks on volume alone', () => {
    expect(muscleRank(70_000, null, true)).toBe('B');
  });
});
