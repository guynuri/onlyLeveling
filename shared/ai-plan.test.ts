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
    expect(r.corrections.map((c) => c.to).sort((a, b) => a - b)).toEqual([8, 12]);
  });

  it('a fractional rep count inside the range is rounded without a correction', () => {
    const r = validateAiPlan(plan([{ label: 'A', exercises: [ex({ reps: 8.4 })] }, { label: 'B', exercises: [ex({ exerciseId: 'fx_b' })] }]), input);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.plan.days[0].exercises[0].reps).toBe(8);
    expect(r.corrections).toEqual([]);
  });
});

describe('validateAiPlan: per-exercise loads (equipment)', () => {
  const eqInput: PlanInput = {
    ...input,
    candidates: {
      fx_a: { name: 'Alpha Press', repMin: 8, repMax: 12 },
      bw_push: { name: 'Push-up', repMin: 8, repMax: 15, loads: null },
      kb_swing: { name: 'Swing', repMin: 8, repMax: 12, loads: [12, 16] },
    },
  };
  const two = (a: Record<string, unknown>, b: Record<string, unknown> = {}) =>
    JSON.stringify({ plan: { name: 'S', days: [{ label: 'A', exercises: [ex(a)] }, { label: 'B', exercises: [ex({ exerciseId: 'fx_a', ...b })] }] }, note: 'Guidance.' });

  it('a weight on a bodyweight exercise becomes 0 and is reported', () => {
    const r = validateAiPlan(two({ exerciseId: 'bw_push', w: 20 }), eqInput);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.plan.days[0].exercises[0].w).toBe(0);
    expect(r.corrections).toEqual([expect.objectContaining({ path: 'days[0].exercises[0].w', from: 20, to: 0 })]);
  });

  it('w 0 on a bodyweight exercise needs no correction', () => {
    const r = validateAiPlan(two({ exerciseId: 'bw_push', w: 0 }), eqInput);
    expect(r.ok && r.corrections).toEqual([]);
  });

  it('w 0 on a weighted exercise is rejected', () => {
    expect(validateAiPlan(two({ exerciseId: 'fx_a', w: 0 }), eqInput).ok).toBe(false);
  });

  it('a kettlebell exercise snaps to its own weights, not the dumbbells', () => {
    const r = validateAiPlan(two({ exerciseId: 'kb_swing', w: 15 }), eqInput);
    expect(r.ok && r.plan.days[0].exercises[0].w).toBe(12);
  });
});

describe('validateAiPlan: time budget and focus (owner decision 2026-11-17)', () => {
  const ids = ['fx_a', 'fx_b', 'fx_c', 'fx_d', 'fx_e', 'fx_f'];
  const timeInput: PlanInput = {
    daysPerWeek: 1,
    exercisesPerDay: 8,
    owned: [4, 6, 8, 10],
    avoid: [],
    candidates: {
      fx_a: { name: 'A', repMin: 8, repMax: 12, groups: ['chest'] },
      fx_b: { name: 'B', repMin: 8, repMax: 12, groups: ['back'] },
      fx_c: { name: 'C', repMin: 8, repMax: 12, groups: ['shoulders'] },
      fx_d: { name: 'D', repMin: 8, repMax: 12, groups: ['quads'] },
      fx_e: { name: 'E', repMin: 8, repMax: 12, groups: ['core'] },
      fx_f: { name: 'F', repMin: 8, repMax: 12, groups: ['hamstrings'] },
      fx_plank: { name: 'Plank', repMin: 20, repMax: 60, groups: ['core'], timed: true, loads: null },
    },
    restSec: 90,
  };
  const oneDay = (list: string[], over: Record<string, unknown> = {}) => plan([{ label: 'Day A', exercises: list.map((id) => ex({ exerciseId: id, ...over })) }]);
  // Counted at the top of the 8–12 range: 3×48 + 2×90 + 90 = 414 s an exercise.
  const per = 414;

  it('a day over budget drops exercises from the end and reports each drop', () => {
    const r = validateAiPlan(oneDay(ids), { ...timeInput, dayBudgetSec: [per * 4] });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.plan.days[0].exercises.map((e) => e.exerciseId)).toEqual(['fx_a', 'fx_b', 'fx_c', 'fx_d']);
    expect(r.corrections.filter((c) => c.to === 0).map((c) => c.why)).toEqual([expect.stringMatching(/dropped F/), expect.stringMatching(/dropped E/)]);
  });

  it('a day a little over (within the tolerance) is kept', () => {
    const r = validateAiPlan(oneDay(ids.slice(0, 4)), { ...timeInput, dayBudgetSec: [Math.ceil((per * 4) / 1.09)] });
    expect(r.ok && r.plan.days[0].exercises).toHaveLength(4);
  });

  it('focus exercises are dropped last', () => {
    const r = validateAiPlan(oneDay(ids), { ...timeInput, dayBudgetSec: [per * 4], focus: ['hamstrings'] });
    expect(r.ok && r.plan.days[0].exercises.map((e) => e.exerciseId)).toEqual(['fx_a', 'fx_b', 'fx_c', 'fx_f']);
  });

  it('never trims below the minimum', () => {
    const r = validateAiPlan(oneDay(ids), { ...timeInput, dayBudgetSec: [60] });
    expect(r.ok && r.plan.days[0].exercises).toHaveLength(3);
  });

  it('no budget (an older app): no trimming', () => {
    const r = validateAiPlan(oneDay(ids), timeInput);
    expect(r.ok && r.plan.days[0].exercises).toHaveLength(6);
  });

  it('a focus muscle with no more sets than the others gets sets added', () => {
    const r = validateAiPlan(oneDay(['fx_a', 'fx_b', 'fx_e']), { ...timeInput, focus: ['core'] });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.plan.days[0].exercises.find((e) => e.exerciseId === 'fx_e')?.sets).toBe(4);
    expect(r.corrections).toContainEqual(expect.objectContaining({ from: 3, to: 4, why: 'more sets for your focus on core' }));
  });

  it('a focus muscle the plan leaves out gets an exercise added', () => {
    const r = validateAiPlan(oneDay(['fx_a', 'fx_b', 'fx_c']), { ...timeInput, focus: ['core'] });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const added = r.plan.days[0].exercises.find((e) => e.exerciseId === 'fx_e');
    expect(added).toMatchObject({ sets: 4, reps: 8, w: 6 }); // added at 3 sets, then one more to beat the others' 3
    expect(r.corrections[0]).toMatchObject({ from: 0, to: 3, why: 'added E for your focus on core' });
  });

  it('a focus muscle already ahead is left alone', () => {
    const r = validateAiPlan(oneDay(['fx_a', 'fx_e']).replace('"sets":3}]', '"sets":5}]'), { ...timeInput, focus: ['core'] });
    expect(r.ok && r.corrections).toEqual([]);
  });

  it('more exercises than the ceiling is still an error', () => {
    const r = validateAiPlan(oneDay(ids), { ...timeInput, exercisesPerDay: 5 });
    expect(r.ok).toBe(false);
  });
});

describe('validateAiPlan: time and focus edge cases', () => {
  const base: PlanInput = {
    daysPerWeek: 1,
    exercisesPerDay: 8,
    owned: [4, 6, 8, 10],
    avoid: [],
    supersets: true,
    restSec: 90,
    candidates: Object.fromEntries(['a', 'b', 'c', 'd', 'e'].map((k) => [`fx_${k}`, { name: k.toUpperCase(), repMin: 8, repMax: 12, groups: [k === 'e' ? 'core' : 'chest'] }])),
  };
  const day = (list: [string, string?][]) => plan([{ label: 'A', exercises: list.map(([id, superset]) => ex({ exerciseId: id, ...(superset ? { superset } : {}) })) }]);

  it('a superset that loses a member to the trim is dropped, a whole one is kept', () => {
    // Superset A+B 618 s, C 414 s, D+E 618 s = 1650 s. Without E: 618 + 414 + 414 = 1446 s, inside 1400 × 1.1.
    const r = validateAiPlan(day([['fx_a', 'A'], ['fx_b', 'A'], ['fx_c'], ['fx_d', 'B'], ['fx_e', 'B']]), { ...base, dayBudgetSec: [1400] });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const ids = r.plan.days[0].exercises.map((e) => e.exerciseId);
    expect(ids).toEqual(['fx_a', 'fx_b', 'fx_c', 'fx_d']);
    expect(r.plan.days[0].supersets).toEqual([['fx_a', 'fx_b']]);
  });

  it('a focus set is not added when it would push the day over its time', () => {
    const r = validateAiPlan(day([['fx_a'], ['fx_b'], ['fx_e']]), { ...base, supersets: false, focus: ['core'], dayBudgetSec: [414 * 3] });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.plan.days[0].exercises.map((e) => e.exerciseId)).toEqual(['fx_a', 'fx_b', 'fx_e']);
    expect(r.corrections).toEqual([]);
  });

  it('a focus exercise goes to the day with the most time left', () => {
    const two = { ...base, daysPerWeek: 2, supersets: false, focus: ['core'], dayBudgetSec: [414 * 4, 414 * 8] };
    const raw = plan([
      { label: 'A', exercises: [ex({ exerciseId: 'fx_a' }), ex({ exerciseId: 'fx_b' })] },
      { label: 'B', exercises: [ex({ exerciseId: 'fx_c' }), ex({ exerciseId: 'fx_d' })] },
    ]);
    const r = validateAiPlan(raw, two);
    expect(r.ok && r.plan.days[1].exercises.map((e) => e.exerciseId)).toContain('fx_e');
  });
});
