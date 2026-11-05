import { describe, it, expect } from 'vitest';
import { createRegistry } from './registry';

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
});
