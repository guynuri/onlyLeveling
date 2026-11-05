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

  it('reserves the Wave 2 ids: a module without the claim cannot take one', () => {
    const r = createRegistry();
    expect(() => r.register({ id: 'coach', label: 'Coach' })).toThrow('reserved for Wave 2');
    expect(r.list()).toHaveLength(0);
  });

  it('the owning Wave 2 phase registers its reserved id with the claim', () => {
    const r = createRegistry();
    r.register({ id: 'coach', label: 'Coach' }, { claimReserved: true });
    expect(r.list().map((m) => m.id)).toEqual(['coach']);
  });

  it('the reserved list is unique and is the five Wave 2 ids', () => {
    expect(WAVE2_MODULE_IDS).toEqual(['coach', 'xp', 'ai', 'push', 'nutrition']);
    expect(new Set(WAVE2_MODULE_IDS).size).toBe(WAVE2_MODULE_IDS.length);
  });
});
