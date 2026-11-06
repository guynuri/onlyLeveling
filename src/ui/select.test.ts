import { describe, it, expect } from 'vitest';
import { toggleIn, pct } from './select';

describe('toggleIn', () => {
  it('adds a missing value and removes a present one', () => {
    expect(toggleIn(['a'], 'b')).toEqual(['a', 'b']);
    expect(toggleIn(['a', 'b'], 'a')).toEqual(['b']);
  });
  it('does not mutate the input', () => {
    const list = ['a'];
    toggleIn(list, 'b');
    expect(list).toEqual(['a']);
  });
});

describe('pct', () => {
  it('clamps to 0..100', () => {
    expect(pct(50, 200)).toBe(25);
    expect(pct(300, 200)).toBe(100);
    expect(pct(-5, 200)).toBe(0);
  });
  it('is 0 when max is 0 or negative', () => {
    expect(pct(5, 0)).toBe(0);
    expect(pct(5, -1)).toBe(0);
  });
});
