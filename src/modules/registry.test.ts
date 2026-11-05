import { describe, it, expect } from 'vitest';
import { createRegistry, WAVE2_MODULE_IDS } from './registry';

describe('module registry', () => {
  it('throws on a duplicate id', () => {
    const r = createRegistry();
    r.register({ id: 'training', label: 'Training' });
    expect(() => r.register({ id: 'training', label: 'Again' })).toThrow('Duplicate module id: training');
  });

  it('keeps registration order', () => {
    const r = createRegistry();
    r.register({ id: 'b', label: 'B' });
    r.register({ id: 'a', label: 'A' });
    expect(r.list().map((m) => m.id)).toEqual(['b', 'a']);
  });

  it('reserves the Wave 2 slots, unique, so a later phase cannot pick a clashing id', () => {
    expect(WAVE2_MODULE_IDS).toEqual(['coach', 'xp', 'ai', 'push', 'nutrition']);
    expect(new Set(WAVE2_MODULE_IDS).size).toBe(WAVE2_MODULE_IDS.length);
  });
});
