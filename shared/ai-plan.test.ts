import { describe, it, expect } from 'vitest';
import { validateAiPlan, type PlanInput } from './ai-plan';

const input: PlanInput = {
  daysPerWeek: 2,
  exercisesPerDay: 2,
  owned: [4, 6, 8, 10],
  avoid: ['fx_avoid'],
  candidates: {
    fx_a: { name: 'Alpha Press', repMin: 8, repMax: 12 },
    fx_b: { name: 'Beta Row', repMin: 8, repMax: 12 },
    fx_avoid: { name: 'Avoided Lift', repMin: 8, repMax: 12 },
  },
};

const ex = (over: Record<string, unknown> = {}) => ({ exerciseId: 'fx_a', reason: 'Chest', w: 8, reps: 10, sets: 3, ...over });
const plan = (days: unknown[] = [{ label: 'Day A', exercises: [ex()] }, { label: 'Day B', exercises: [ex({ exerciseId: 'fx_b' })] }], over: Record<string, unknown> = {}) =>
  JSON.stringify({ plan: { name: 'Starter', days, ...over }, note: 'Training guidance.' });

const errorsOf = (raw: unknown) => {
  const r = validateAiPlan(raw, input);
  return r.ok ? [] : r.errors;
};

describe('validateAiPlan: SPEC §5.5 checks', () => {
  it('a clean answer passes with no corrections', () => {
    const r = validateAiPlan(plan(), input);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.corrections).toEqual([]);
  });

  it('non-JSON is rejected', () => {
    expect(errorsOf('not json at all')).toEqual(['not JSON']);
  });

  it('a missing key is rejected', () => {
    expect(validateAiPlan(JSON.stringify({ plan: { name: 'x', days: [] } }), input).ok).toBe(false);
  });

  it('a wrong type is rejected', () => {
    expect(errorsOf(plan([{ label: 'Day A', exercises: [ex({ reps: 'ten' })] }, { label: 'Day B', exercises: [ex({ exerciseId: 'fx_b' })] }]))).toEqual(
      expect.arrayContaining([expect.stringMatching(/needs numeric w, reps and sets/)]),
    );
  });

  it('text over its length limit is rejected: name 60, reason 200, note 400', () => {
    expect(errorsOf(plan(undefined, { name: 'x'.repeat(61) }))).toEqual(expect.arrayContaining([expect.stringMatching(/plan.name/)]));
    const long = plan([{ label: 'Day A', exercises: [ex({ reason: 'x'.repeat(201) })] }, { label: 'Day B', exercises: [ex({ exerciseId: 'fx_b' })] }]);
    expect(errorsOf(long)).toEqual(expect.arrayContaining([expect.stringMatching(/reason is over 200/)]));
    const longNote = JSON.stringify({ plan: { name: 'S', days: [] }, note: 'x'.repeat(401) });
    expect(errorsOf(longNote)).toEqual(expect.arrayContaining([expect.stringMatching(/note is over 400/)]));
  });

  it('an unknown exerciseId is rejected', () => {
    expect(errorsOf(plan([{ label: 'A', exercises: [ex({ exerciseId: 'fx_nope' })] }, { label: 'B', exercises: [ex({ exerciseId: 'fx_b' })] }]))).toEqual(
      expect.arrayContaining([expect.stringMatching(/unknown exerciseId fx_nope/)]),
    );
  });

  it('a non-dumbbell exercise is rejected: it is not in the candidate list', () => {
    expect(errorsOf(plan([{ label: 'A', exercises: [ex({ exerciseId: 'fx_barbell' })] }, { label: 'B', exercises: [ex({ exerciseId: 'fx_b' })] }]))).toEqual(
      expect.arrayContaining([expect.stringMatching(/unknown exerciseId/)]),
    );
  });

  it('an avoided exercise is rejected', () => {
    expect(errorsOf(plan([{ label: 'A', exercises: [ex({ exerciseId: 'fx_avoid' })] }, { label: 'B', exercises: [ex({ exerciseId: 'fx_b' })] }]))).toEqual(
      expect.arrayContaining([expect.stringMatching(/avoid list/)]),
    );
  });

  it('a day count different from the setting is rejected', () => {
    expect(errorsOf(plan([{ label: 'A', exercises: [ex()] }]))).toEqual(expect.arrayContaining([expect.stringMatching(/1 days, the setting is 2/)]));
  });

  it('more exercises per day than the session fits is rejected', () => {
    const many = [ex(), ex({ exerciseId: 'fx_b' }), ex({ exerciseId: 'fx_a', reason: 'again' })];
    expect(errorsOf(plan([{ label: 'A', exercises: many }, { label: 'B', exercises: [ex({ exerciseId: 'fx_b' })] }]))).toEqual(
      expect.arrayContaining([expect.stringMatching(/fits 2/)]),
    );
  });

  it('markup or a link in text is rejected', () => {
    for (const bad of ['<b>Chest</b>', 'see [press](https://example.com)', 'visit https://example.com', 'use `code`']) {
      const r = errorsOf(plan([{ label: 'A', exercises: [ex({ reason: bad })] }, { label: 'B', exercises: [ex({ exerciseId: 'fx_b' })] }]));
      expect(r, bad).toEqual(expect.arrayContaining([expect.stringMatching(/plain text only/)]));
    }
  });

  it('sets outside 1 to 5 are rejected', () => {
    expect(errorsOf(plan([{ label: 'A', exercises: [ex({ sets: 9 })] }, { label: 'B', exercises: [ex({ exerciseId: 'fx_b' })] }]))).toEqual(
      expect.arrayContaining([expect.stringMatching(/sets must be 1 to 5/)]),
    );
  });

  it('a duplicate exercise within one day is rejected', () => {
    expect(errorsOf(plan([{ label: 'A', exercises: [ex(), ex({ reason: 'again' })] }, { label: 'B', exercises: [ex({ exerciseId: 'fx_b' })] }]))).toEqual(
      expect.arrayContaining([expect.stringMatching(/appears twice/)]),
    );
  });
});

describe('validateAiPlan: corrections, not errors', () => {
  it('a weight off the owned list snaps down to a bell and is reported', () => {
    const r = validateAiPlan(plan([{ label: 'A', exercises: [ex({ w: 9 })] }, { label: 'B', exercises: [ex({ exerciseId: 'fx_b' })] }]), input);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.plan.days[0].exercises[0].w).toBe(8);
    expect(r.corrections).toEqual([expect.objectContaining({ path: 'days[0].exercises[0].w', from: 9, to: 8 })]);
  });

  it('reps outside the rep range are clamped and reported', () => {
    const r = validateAiPlan(plan([{ label: 'A', exercises: [ex({ reps: 15 })] }, { label: 'B', exercises: [ex({ exerciseId: 'fx_b', reps: 3 })] }]), input);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.plan.days[0].exercises[0].reps).toBe(12);
    expect(r.plan.days[1].exercises[0].reps).toBe(8);
    expect(r.corrections.map((c) => c.to).sort()).toEqual([8, 12]);
  });
});
