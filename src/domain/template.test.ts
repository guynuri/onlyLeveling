import { describe, it, expect } from 'vitest';
import { candidates, type TemplateInput } from './template';
import type { Exercise } from './exercise';
import { blockedIds } from './profile';

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
  equipment: ['dumbbell'],
  ...over,
});

describe('candidates suit a starter dumbbell plan', () => {
  it('leaves out expert, timed and non-strength exercises', () => {
    const pool = candidates({
      daysPerWeek: 1,
      exercisesPerDay: 4,
      avoid: [],
      equipment: ['dumbbell'],
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

describe('limits reach the plan builder', () => {
  it('with a knee limit, no quad exercise is a candidate', () => {
    const catalogue = [
      ex({ id: 'Squat', muscles: { primary: ['quadriceps'], secondary: [] } }),
      ex({ id: 'Press', muscles: { primary: ['chest'], secondary: [] } }),
    ];
    const avoid = [...blockedIds({ daysPerWeek: 3, restSec: 90, owned: [4], limits: { parts: ['knee'], note: '' } }, catalogue)];
    expect(candidates({ daysPerWeek: 1, exercisesPerDay: 2, avoid, catalogue, equipment: ['dumbbell'] }).map((e) => e.id)).toEqual(['Press']);
  });
});

describe('candidates prefer exercises with pictures', () => {
  it('between two otherwise equal candidates, the one with media comes first', () => {
    const pool = candidates({
      daysPerWeek: 1,
      exercisesPerDay: 2,
      avoid: [],
      equipment: ['dumbbell'],
      catalogue: [ex({ id: 'A_Plain' }), ex({ id: 'B_Pictured', media: { stills: ['media/repdb/b.webp'] } })],
    });
    expect(pool.map((e) => e.id)).toEqual(['B_Pictured', 'A_Plain']);
  });
});

describe('candidates follow the owned equipment', () => {
  it('with nothing picked only equipment-free exercises are offered', () => {
    const pool = candidates(INPUT({ equipment: [] }));
    expect(pool.map((e) => e.id)).toEqual(['BW_Pushup']);
  });
  it('picking dumbbells adds the dumbbell exercises', () => {
    const ids = candidates(INPUT({ equipment: ['dumbbell'] })).map((e) => e.id);
    expect(ids).toContain('DB_Press');
    expect(ids).toContain('BW_Pushup');
  });
});
