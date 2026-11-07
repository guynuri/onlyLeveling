import { describe, it, expect } from 'vitest';
import { badgeCatalogue } from './badges';

describe('badgeCatalogue', () => {
  it('lists every fixed badge and one per muscle, earned first', () => {
    const c = badgeCatalogue(['session:1', 'muscle:chest:C', 'muscle:chest:B']);
    expect(c).toHaveLength(3 + 2 + 10);
    expect(c.slice(0, 2).map((b) => b.key)).toEqual(['session:1', 'muscle:chest:B']); // best chest badge only
    expect(c.slice(2).every((b) => !b.earned)).toBe(true);
    expect(c.find((b) => b.key === 'muscle:back:C')).toMatchObject({ earned: false, hint: 'Reach rank C on Back', rank: 'C' });
  });
});
