import { describe, it, expect } from 'vitest';
import { supersetRuns, validateAiPlan } from './ai-plan';
import { buildPrompt } from './ai-prompt';

describe('supersetRuns (AI superset letters)', () => {
  it('keeps adjacent runs of 2–3 with the same letter, first run of a letter only', () => {
    const ids = ['a', 'b', 'c', 'd', 'e', 'f', 'g'];
    expect(supersetRuns(ids, ['A', 'A', null, 'B', 'B', 'B', null])).toEqual([['a', 'b'], ['d', 'e', 'f']]);
    expect(supersetRuns(ids, ['A', null, 'A', null, null, null, null])).toEqual([]); // not adjacent
    expect(supersetRuns(ids, ['A', 'A', 'A', 'A', null, null, null])).toEqual([]); // too long
    expect(supersetRuns(ids, ['A', 'A', null, 'A', 'A', null, null])).toEqual([['a', 'b']]); // letter reused
    expect(supersetRuns(ids, ['A', 'A', 'A', 'A', null, 'A', 'A'])).toEqual([['f', 'g']]); // a dropped run does not use up the letter
    expect(supersetRuns(ids, ['A', 'A', null, 'B', 'B', 'B', null], 2)).toEqual([['a', 'b']]); // pairs only: the triple is dropped
  });
});

describe('buildPrompt superset switch', () => {
  const req = { summary: {}, candidates: { x: { name: 'X', repMin: 8, repMax: 12 } }, daysPerWeek: 1, exercisesPerDay: 4, owned: [], avoid: [] };
  it('asks for supersets only when switched on', () => {
    expect(buildPrompt({ ...req, supersets: true })).toContain('Use supersets');
    expect(buildPrompt(req)).toContain('Do not use the "superset" field.');
    expect(buildPrompt({ ...req, supersets: true, supersetSize: 2 })).toContain('exactly 2 exercises');
    expect(buildPrompt({ ...req, supersets: true, supersetSize: 3 })).toContain('2 to 3 exercises');
  });
  it('lists warm-up and cool-down choices only when given', () => {
    expect(buildPrompt({ ...req, routine: { s1: 'Chest stretch' } })).toContain('s1 | Chest stretch');
    expect(buildPrompt(req)).not.toContain('Stretch list');
  });
});

describe('validateAiPlan routine picks', () => {
  const input = {
    daysPerWeek: 1,
    exercisesPerDay: 4,
    owned: [10],
    avoid: [],
    candidates: { x: { name: 'X', repMin: 8, repMax: 12 } },
    routine: { s1: 'Stretch 1', s2: 'Stretch 2' },
  };
  const answer = (day: Record<string, unknown>) => ({
    plan: { name: 'P', days: [{ label: 'A', exercises: [{ exerciseId: 'x', reason: 'r', w: 10, reps: 10, sets: 3 }], ...day }] },
    note: 'n',
  });
  it('keeps only listed ids, once each; anything else is dropped, not an error', () => {
    const r = validateAiPlan(answer({ warmup: ['s1', 'evil', 's1', 's2'], cooldown: 'nope' }), input);
    expect(r.ok && r.plan.days[0].warmup).toEqual(['s1', 's2']);
    expect(r.ok && r.plan.days[0].cooldown).toBeUndefined();
  });
});
