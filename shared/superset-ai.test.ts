import { describe, it, expect } from 'vitest';
import { supersetRuns } from './ai-plan';
import { buildPrompt } from './ai-prompt';

describe('supersetRuns (AI superset letters)', () => {
  it('keeps adjacent runs of 2–3 with the same letter, first run of a letter only', () => {
    const ids = ['a', 'b', 'c', 'd', 'e', 'f', 'g'];
    expect(supersetRuns(ids, ['A', 'A', null, 'B', 'B', 'B', null])).toEqual([['a', 'b'], ['d', 'e', 'f']]);
    expect(supersetRuns(ids, ['A', null, 'A', null, null, null, null])).toEqual([]); // not adjacent
    expect(supersetRuns(ids, ['A', 'A', 'A', 'A', null, null, null])).toEqual([]); // too long
    expect(supersetRuns(ids, ['A', 'A', null, 'A', 'A', null, null])).toEqual([['a', 'b']]); // letter reused
  });
});

describe('buildPrompt superset switch', () => {
  const req = { summary: {}, candidates: { x: { name: 'X', repMin: 8, repMax: 12 } }, daysPerWeek: 1, exercisesPerDay: 4, owned: [], avoid: [] };
  it('asks for supersets only when switched on', () => {
    expect(buildPrompt({ ...req, supersets: true })).toContain('Use supersets');
    expect(buildPrompt(req)).toContain('Do not use the "superset" field.');
  });
});
