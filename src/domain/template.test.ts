import { describe, it, expect } from 'vitest';
import { buildTemplate, candidates, type TemplateInput } from './template';
import type { Exercise } from './exercise';

const ex = (over: Partial<Exercise> & { id: string }): Exercise => ({
  name: over.id,
  aliases: [],
  equipment: 'dumbbell',
  force: 'push',
  mechanic: 'compound',
  level: 'beginner',
  category: 'strength',
  primaryMuscles: ['chest'],
  secondaryMuscles: [],
  movementPattern: 'push',
  instructions: [],
  requires: [],
  mode: 'reps',
  muscles: { primary: [], secondary: [] },
  source: 'free-exercise-db',
  textSource: 'free-exercise-db',
  license: 'Unlicense',
  author: null,
  sourceUrl: null,
  ...over,
});

const CATALOGUE: Exercise[] = [
  ex({ id: 'DB_Press', primaryMuscles: ['chest'], force: 'push' }),
  ex({ id: 'DB_Row', primaryMuscles: ['lats'], force: 'pull' }),
  ex({ id: 'DB_Squat', primaryMuscles: ['quadriceps'], force: 'push' }),
  ex({ id: 'DB_Curl', primaryMuscles: ['biceps'], force: 'pull', mechanic: 'isolation' }),
  ex({ id: 'DB_Fly', primaryMuscles: ['chest'], force: 'push', mechanic: 'isolation' }),
  ex({ id: 'DB_Hold', primaryMuscles: ['abdominals'], force: 'static', mechanic: null }),
  ex({ id: 'BAR_Bench', equipment: 'barbell', primaryMuscles: ['chest'] }),
  ex({ id: 'MACH_Leg', equipment: 'machine', primaryMuscles: ['quadriceps'] }),
  ex({ id: 'DB_Unknown', primaryMuscles: ['glutes'], force: null, mechanic: null, movementPattern: 'unknown' }),
  ex({ id: 'BW_Pushup', equipment: 'bodyweight', primaryMuscles: ['chest'] }),
];

const INPUT = (over: Partial<TemplateInput> = {}): TemplateInput => ({
  daysPerWeek: 3,
  exercisesPerDay: 3,
  avoid: [],
  catalogue: CATALOGUE,
  ...over,
});

describe('buildTemplate', () => {
  it('day count equals days per week', () => {
    expect(buildTemplate(INPUT({ daysPerWeek: 4 })).days).toHaveLength(4);
    expect(buildTemplate(INPUT({ daysPerWeek: 2 })).days).toHaveLength(2);
  });

  it('never picks non-dumbbell equipment (bodyweight is allowed, per D9)', () => {
    const plan = buildTemplate(INPUT({ daysPerWeek: 3, exercisesPerDay: 5 }));
    const ids = plan.days.flatMap((d) => d.exerciseIds);
    expect(ids).not.toContain('BAR_Bench');
    expect(ids).not.toContain('MACH_Leg');
  });

  it('excludes avoided exercises by id', () => {
    const plan = buildTemplate(INPUT({ avoid: ['DB_Press'], exercisesPerDay: 5 }));
    expect(plan.days.flatMap((d) => d.exerciseIds)).not.toContain('DB_Press');
  });

  it('never picks an exercise whose movement pattern is unknown', () => {
    const plan = buildTemplate(INPUT({ daysPerWeek: 3, exercisesPerDay: 5 }));
    expect(plan.days.flatMap((d) => d.exerciseIds)).not.toContain('DB_Unknown');
  });

  it('no exercise repeats inside one day', () => {
    for (const day of buildTemplate(INPUT({ exercisesPerDay: 5 })).days) {
      expect(new Set(day.exerciseIds).size).toBe(day.exerciseIds.length);
    }
  });

  it('warm-up and cool-down are separate blocks, not exercises', () => {
    for (const day of buildTemplate(INPUT()).days) {
      expect(day.warmup.length).toBeGreaterThan(0);
      expect(day.cooldown.length).toBeGreaterThan(0);
      // Routine items are never in the exercise list, and exercise ids are catalogue ids only.
      const routineNames = [...day.warmup, ...day.cooldown].map((r) => r.name);
      for (const id of day.exerciseIds) {
        expect(routineNames).not.toContain(id);
        expect(CATALOGUE.map((c) => c.id)).toContain(id);
      }
    }
  });

  it('is deterministic for the same input', () => {
    expect(buildTemplate(INPUT())).toEqual(buildTemplate(INPUT()));
  });
});

describe('candidates suit a starter dumbbell plan', () => {
  it('leaves out expert, timed and non-strength exercises', () => {
    const pool = candidates({
      daysPerWeek: 1,
      exercisesPerDay: 4,
      avoid: [],
      catalogue: [
        ex({ id: 'OK_Press' }),
        ex({ id: 'Expert_Handstand', level: 'expert' }),
        ex({ id: 'Timed_Plank', mode: 'time' }),
        ex({ id: 'Plyo_Pushup', category: 'plyometrics' }),
      ],
    });
    expect(pool.map((e) => e.id)).toEqual(['OK_Press']);
  });
});

describe('candidates prefer exercises with pictures', () => {
  it('between two otherwise equal candidates, the one with media comes first', () => {
    const pool = candidates({
      daysPerWeek: 1,
      exercisesPerDay: 2,
      avoid: [],
      catalogue: [ex({ id: 'A_Plain' }), ex({ id: 'B_Pictured', media: { stills: ['media/repdb/b.webp'] } })],
    });
    expect(pool.map((e) => e.id)).toEqual(['B_Pictured', 'A_Plain']);
  });
});
