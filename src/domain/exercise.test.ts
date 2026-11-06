import { describe, it, expect } from 'vitest';
import { isDumbbellCompatible, movementPattern, type Exercise } from './exercise';

const ex = (over: Partial<Exercise>): Exercise => ({
  id: 'fx_x',
  name: 'x',
  aliases: [],
  equipment: 'dumbbell',
  force: 'push',
  mechanic: 'compound',
  level: 'beginner',
  category: 'strength',
  primaryMuscles: [],
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

describe('isDumbbellCompatible', () => {
  it.each([
    ['dumbbell', true],
    ['bodyweight', true],
    ['barbell', false],
    ['machine', false],
    ['cable', false],
    ['kettlebell', false],
    ['band', false],
    ['other', false],
    ['unknown', false],
  ] as const)('%s → %s', (equipment, expected) => {
    expect(isDumbbellCompatible(ex({ equipment }))).toBe(expected);
  });
});

describe('isDumbbellCompatible with required kit', () => {
  it('rejects an exercise that also needs a bench', () => {
    expect(isDumbbellCompatible(ex({ equipment: 'dumbbell', requires: ['dumbbell', 'bench'] }))).toBe(false);
  });
  it('accepts an equipment-free exercise', () => {
    expect(isDumbbellCompatible(ex({ equipment: 'bodyweight', requires: [] }))).toBe(true);
  });
  it('rejects a bodyweight exercise that needs a pull-up bar', () => {
    expect(isDumbbellCompatible(ex({ equipment: 'bodyweight', requires: ['pullup_bar'] }))).toBe(false);
  });
});

describe('movementPattern', () => {
  it.each([
    ['push', 'push'],
    ['pull', 'pull'],
    ['static', 'static'],
    [null, 'unknown'],
  ] as const)('force %s → %s', (force, expected) => {
    expect(movementPattern(ex({ force, movementPattern: 'unknown' }))).toBe(expected);
  });

  it('never returns squat or hinge', () => {
    const forces = ['push', 'pull', 'static', null] as const;
    for (const force of forces) {
      for (const mechanic of ['compound', 'isolation', null] as const) {
        const p = movementPattern(ex({ force, mechanic }));
        expect(['push', 'pull', 'static', 'unknown']).toContain(p);
      }
    }
  });
});
