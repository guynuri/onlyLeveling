import { describe, it, expect } from 'vitest';
import { mapFreeExercise, type FreeExerciseRaw } from './exercise-import';

const raw = (over: Partial<FreeExerciseRaw> = {}): FreeExerciseRaw => ({
  id: 'Dumbbell_Curl',
  name: 'Dumbbell Curl',
  force: 'pull',
  level: 'beginner',
  mechanic: 'isolation',
  equipment: 'dumbbell',
  category: 'strength',
  primaryMuscles: ['biceps'],
  secondaryMuscles: ['forearms'],
  instructions: ['Stand up.', 'Curl the weight.'],
  images: ['Dumbbell_Curl/0.jpg', 'Dumbbell_Curl/1.jpg'],
  ...over,
});

describe('mapFreeExercise', () => {
  it('maps fields and sets the Unlicense licence on every record', () => {
    const ex = mapFreeExercise(raw());
    expect(ex).toMatchObject({
      id: 'fx_Dumbbell_Curl',
      name: 'Dumbbell Curl',
      aliases: [],
      equipment: 'dumbbell',
      force: 'pull',
      mechanic: 'isolation',
      level: 'beginner',
      category: 'strength',
      primaryMuscles: ['biceps'],
      secondaryMuscles: ['forearms'],
      movementPattern: 'pull',
      instructions: ['Stand up.', 'Curl the weight.'],
      source: 'free-exercise-db',
      textSource: 'free-exercise-db',
      license: 'Unlicense',
      author: null,
      sourceUrl: 'https://github.com/yuhonas/free-exercise-db',
    });
  });

  it('never writes image fields, even when the upstream record has them', () => {
    const ex = mapFreeExercise(raw()) as unknown as Record<string, unknown>;
    expect('images' in ex).toBe(false);
    expect(JSON.stringify(ex)).not.toContain('.jpg');
  });

  it('maps every upstream equipment value, and null to unknown', () => {
    const cases: Array<[string | null, string]> = [
      ['barbell', 'barbell'],
      ['e-z curl bar', 'barbell'],
      ['dumbbell', 'dumbbell'],
      ['kettlebells', 'kettlebell'],
      ['cable', 'cable'],
      ['machine', 'machine'],
      ['body only', 'bodyweight'],
      ['bands', 'band'],
      ['medicine ball', 'other'],
      ['exercise ball', 'other'],
      ['foam roll', 'other'],
      ['other', 'other'],
      [null, 'unknown'],
    ];
    for (const [input, expected] of cases) {
      expect(mapFreeExercise(raw({ equipment: input })).equipment).toBe(expected);
    }
  });

  it('keeps null force and mechanic as null', () => {
    const ex = mapFreeExercise(raw({ force: null, mechanic: null }));
    expect(ex.force).toBeNull();
    expect(ex.mechanic).toBeNull();
    expect(ex.movementPattern).toBe('unknown');
  });

  it('throws on an unrecognised value instead of guessing', () => {
    expect(() => mapFreeExercise(raw({ equipment: 'trap bar' }))).toThrow(/Unmapped equipment: trap bar/);
    expect(() => mapFreeExercise(raw({ force: 'squat' }))).toThrow(/Unmapped force: squat/);
    expect(() => mapFreeExercise(raw({ level: 'pro' }))).toThrow(/Unmapped level: pro/);
  });
});
