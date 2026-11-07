import { describe, it, expect } from 'vitest';
import { routineAt, skipMs } from './routine-clock';

const items = [{ seconds: 60 }, { seconds: 30 }];

describe('routineAt', () => {
  it('walks through the items and ends', () => {
    expect(routineAt(items, 0)).toEqual({ index: 0, left: 60 });
    expect(routineAt(items, 59_500)).toEqual({ index: 0, left: 1 });
    expect(routineAt(items, 60_000)).toEqual({ index: 1, left: 30 });
    expect(routineAt(items, 90_000)).toEqual({ index: 2, left: 0 });
    expect(routineAt([], 0)).toEqual({ index: 0, left: 0 });
  });
});

describe('skipMs', () => {
  it('jumps to the start of the next item, nothing once done', () => {
    expect(skipMs(items, 10_000)).toBe(50_000);
    expect(routineAt(items, 10_000 + skipMs(items, 10_000))).toEqual({ index: 1, left: 30 });
    expect(skipMs(items, 95_000)).toBe(0);
  });
});
