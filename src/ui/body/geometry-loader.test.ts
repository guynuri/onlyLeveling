import { describe, it, expect } from 'vitest';
import { createLoader } from './geometry-loader';

describe('createLoader', () => {
  it('loads once and shares the result', async () => {
    let calls = 0;
    const load = createLoader(async () => (calls++, 'geo'));
    expect(await Promise.all([load(), load()])).toEqual(['geo', 'geo']);
    expect(calls).toBe(1);
    expect(load.cached()).toBe('geo');
  });

  it('a failed load is retried on the next call instead of failing forever', async () => {
    let calls = 0;
    const load = createLoader(async () => {
      calls++;
      if (calls === 1) throw new Error('chunk failed');
      return 'geo';
    });
    await expect(load()).rejects.toThrow('chunk failed');
    expect(load.cached()).toBeNull();
    expect(await load()).toBe('geo');
    expect(calls).toBe(2);
  });
});
