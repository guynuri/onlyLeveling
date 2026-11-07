import { describe, it, expect } from 'vitest';
import { addFocus, applyBlend, buildRulesPlan, focusOf } from './plan-builder';
import type { Exercise } from './exercise';
import type { BodySlug } from './muscle-map';
import type { Plan } from './plan';
import type { Goal, Settings } from './types';

const ex = (id: string, over: Partial<Exercise> & { slug: BodySlug }): Exercise => {
  const { slug, ...rest } = over;
  return {
    id,
    name: id,
    aliases: [],
    equipment: 'dumbbell',
    force: 'push',
    mechanic: 'compound',
    level: 'beginner',
    category: 'strength',
    primaryMuscles: [slug],
    secondaryMuscles: [],
    movementPattern: 'push',
    instructions: [],
    requires: ['dumbbell'],
    mode: 'reps',
    muscles: { primary: [slug], secondary: [] },
    source: 'free-exercise-db',
    textSource: 'free-exercise-db',
    license: 'Unlicense',
    author: null,
    sourceUrl: null,
    ...rest,
  } as Exercise;
};

const bw: Partial<Exercise> = { equipment: 'bodyweight', requires: [] };
const CATALOGUE: Exercise[] = [
  ex('DB_Press', { slug: 'chest' }),
  ex('DB_Row', { slug: 'upper-back', force: 'pull' }),
  ex('DB_OHP', { slug: 'deltoids' }),
  ex('DB_Curl', { slug: 'biceps', force: 'pull', mechanic: 'isolation' }),
  ex('DB_Tri', { slug: 'triceps', mechanic: 'isolation' }),
  ex('DB_Squat', { slug: 'quadriceps' }),
  ex('DB_RDL', { slug: 'hamstring', force: 'pull' }),
  ex('DB_Lunge', { slug: 'gluteal' }),
  ex('DB_Calf', { slug: 'calves', mechanic: 'isolation' }),
  ex('KB_Swing', { slug: 'gluteal', equipment: 'kettlebell', requires: ['kettlebell'] }),
  ex('BW_Pushup', { slug: 'chest', ...bw }),
  ex('BW_Row', { slug: 'upper-back', force: 'pull', ...bw }),
  ex('BW_Squat', { slug: 'quadriceps', ...bw }),
  ex('BW_Bridge', { slug: 'gluteal', ...bw }),
];
const LOWER = new Set(['DB_Squat', 'DB_RDL', 'DB_Lunge', 'DB_Calf', 'BW_Squat', 'BW_Bridge', 'KB_Swing']);

const settings = (over: Partial<Settings> = {}): Settings => ({ daysPerWeek: 3, restSec: 90, owned: [8], equipment: ['dumbbell'], ...over });
const build = (over: Partial<Settings> = {}, kind: 'auto' | 'full-body' | 'upper-lower' | 'push-pull-legs' = 'auto', catalogue = CATALOGUE) =>
  buildRulesPlan({ settings: settings(over), catalogue, kind, weeks: 8, now: 1000 });
const planOf = (r: ReturnType<typeof build>): Plan => {
  if (!r.ok) throw new Error('expected a plan');
  return r.plan;
};
const idsOf = (p: Plan) => p.days.flatMap((d) => d.exerciseIds);

describe('buildRulesPlan: equipment', () => {
  it('with nothing picked only equipment-free exercises are used', () => {
    const ids = idsOf(planOf(build({ equipment: [], owned: [] })));
    expect(ids.length).toBeGreaterThan(0);
    expect(ids.every((id) => id.startsWith('BW_'))).toBe(true);
  });
  it('with dumbbells the dumbbell exercises appear and kettlebell ones do not', () => {
    const ids = idsOf(planOf(build()));
    expect(ids.some((id) => id.startsWith('DB_'))).toBe(true);
    expect(ids).not.toContain('KB_Swing');
  });
  it('a limit removes its exercises from a new plan', () => {
    const ids = idsOf(planOf(build({ limits: { parts: ['knee'], note: '' } })));
    expect(ids).not.toContain('DB_Squat');
    expect(ids).not.toContain('BW_Squat');
  });
  it('the avoid list is respected', () => {
    expect(idsOf(planOf(build({ avoid: ['DB_Press'] })))).not.toContain('DB_Press');
  });
});

describe('buildRulesPlan: split', () => {
  const labels = (r: ReturnType<typeof build>) => planOf(r).days.map((d) => d.label);
  it('auto picks the split by days per week', () => {
    expect(labels(build({ daysPerWeek: 3 }))[0]).toMatch(/^Full body/);
    expect(labels(build({ daysPerWeek: 4 }))).toEqual(['Upper A', 'Lower A', 'Upper B', 'Lower B']);
    expect(labels(build({ daysPerWeek: 5 }))).toEqual(['Push A', 'Pull A', 'Legs A', 'Push B', 'Pull B']);
  });
  it('an explicit kind overrides auto', () => {
    expect(labels(build({ daysPerWeek: 3 }, 'upper-lower'))).toEqual(['Upper A', 'Lower A', 'Upper B']);
  });
  it('a full-body day mixes upper and lower exercises', () => {
    for (const d of planOf(build({ daysPerWeek: 3 }, 'full-body')).days) {
      expect(d.exerciseIds.some((id) => LOWER.has(id))).toBe(true);
      expect(d.exerciseIds.some((id) => !LOWER.has(id))).toBe(true);
    }
  });
  it('upper days have no lower-body exercise and lower days only lower-body ones', () => {
    for (const d of planOf(build({ daysPerWeek: 4 })).days) {
      const lower = d.label?.startsWith('Lower');
      expect(d.exerciseIds.every((id) => LOWER.has(id) === !!lower)).toBe(true);
    }
  });
  it('push and pull days follow the exercise force', () => {
    const p = planOf(build({ daysPerWeek: 3 }, 'push-pull-legs'));
    expect(p.days[0].exerciseIds.every((id) => ['DB_Press', 'DB_OHP', 'DB_Tri', 'BW_Pushup'].includes(id))).toBe(true);
    expect(p.days[1].exerciseIds.every((id) => ['DB_Row', 'DB_Curl', 'BW_Row'].includes(id))).toBe(true);
  });
  it('no exercise repeats inside a day, and days are not all the same', () => {
    const p = planOf(build({ daysPerWeek: 4 }));
    for (const d of p.days) expect(new Set(d.exerciseIds).size).toBe(d.exerciseIds.length);
    expect(p.days[0].exerciseIds).not.toEqual(p.days[2].exerciseIds);
  });
});

describe('buildRulesPlan: block, targets and goals', () => {
  const rangeOf = (goals: Goal[]) => {
    const p = planOf(build({ goals }));
    return p.days[0].targets![p.days[0].exerciseIds[0]]; // the first pick is a compound lift
  };
  it('saves a block, a rotation schedule and a target for every exercise', () => {
    const p = planOf(build());
    expect(p.block).toEqual({ weeks: 8, startedAt: 1000, deloadLastWeek: true });
    expect(p.schedule).toBe('rotation');
    for (const d of p.days) for (const id of d.exerciseIds) expect(d.targets?.[id]).toMatchObject({ sets: 3 });
  });
  it('strength lowers the rep targets, endurance raises them, both together cancel', () => {
    expect(rangeOf(['build-muscle'])).toMatchObject({ repMin: 6, repMax: 10 });
    expect(rangeOf(['strength'])).toMatchObject({ repMin: 4, repMax: 8 });
    expect(rangeOf(['endurance'])).toMatchObject({ repMin: 9, repMax: 13 });
    expect(rangeOf(['strength', 'endurance'])).toMatchObject({ repMin: 6, repMax: 10 });
  });
  it('lose-fat adds a post-lift cardio block to the last two days', () => {
    const p = planOf(build({ daysPerWeek: 4, goals: ['lose-fat'] }));
    expect(p.days.map((d) => d.postCardioMinutes)).toEqual([undefined, undefined, 20, 20]);
  });
  it('mobility adds a mobility block to every day', () => {
    const p = planOf(build({ goals: ['mobility'] }));
    expect(p.days.every((d) => d.mobilityMinutes === 5)).toBe(true);
  });
});

describe('buildRulesPlan: nothing fits', () => {
  it('returns no-exercises when no exercise is usable', () => {
    expect(build({ equipment: [], owned: [] }, 'auto', CATALOGUE.filter((e) => e.equipment === 'dumbbell'))).toEqual({ ok: false, error: 'no-exercises' });
  });
  it('returns no-exercises when a day has nothing in its region', () => {
    const upperOnly = CATALOGUE.filter((e) => !LOWER.has(e.id));
    expect(build({ daysPerWeek: 4 }, 'auto', upperOnly)).toEqual({ ok: false, error: 'no-exercises' });
  });
  it('is deterministic', () => {
    expect(build()).toEqual(build());
  });
});

describe('applyBlend', () => {
  it('leaves the days alone for a goal with no cardio or mobility', () => {
    const days = planOf(build()).days;
    expect(applyBlend(days, ['build-muscle'])).toEqual(days);
  });
});

describe('focus muscles (addFocus)', () => {
  const pool = [
    { id: 'press', primaryMuscles: ['chest'], mechanic: 'compound', mode: 'reps' },
    { id: 'fly', primaryMuscles: ['chest'], mechanic: 'isolation', mode: 'reps' },
    { id: 'curl', primaryMuscles: ['biceps'], mechanic: 'isolation', mode: 'reps' },
  ] as unknown as Exercise[];
  const day = (index: number, ids: string[]) => ({
    index,
    warmup: [],
    cooldown: [],
    exerciseIds: ids,
    targets: Object.fromEntries(ids.map((id) => [id, { sets: 3, repMin: 8, repMax: 12 }])),
  });
  it('adds an exercise and a set on the day that trains the muscle', () => {
    const out = addFocus([day(0, ['curl']), day(1, ['press'])], ['chest'], pool, 'none');
    expect(out[1].exerciseIds).toEqual(['press', 'fly']);
    expect(out[1].targets?.press.sets).toBe(4);
    expect(out[0].exerciseIds).toEqual(['curl']);
  });
  it('a muscle no day trains goes to the shortest day', () => {
    const out = addFocus([day(0, ['press', 'fly']), day(1, ['curl'])], ['triceps', 'biceps'], pool, 'none');
    expect(out[1].exerciseIds).toEqual(['curl']); // nothing in the pool trains triceps, and no other biceps move
    expect(out[1].targets?.curl.sets).toBe(4);
  });
  it('focusOf drops repeats', () => {
    expect(focusOf({ focusMuscles: ['chest', 'chest', 'back'] })).toEqual(['chest', 'back']);
  });
  it('focusOf keeps known groups, at most 5', () => {
    expect(focusOf({ focusMuscles: ['chest', 'x', 'back', 'quads', 'calves', 'core', 'glutes'] })).toEqual(['chest', 'back', 'quads', 'calves', 'core']);
  });
});
