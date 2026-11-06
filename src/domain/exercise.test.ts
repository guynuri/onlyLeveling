import { describe, it, expect } from 'vitest';
import { loadKind, movementPattern, usableWith, type Exercise } from './exercise';

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

describe('usableWith', () => {
  it('an equipment-free exercise is usable with nothing picked', () => {
    expect(usableWith(ex({ equipment: 'bodyweight', requires: [] }), [])).toBe(true);
  });
  it('a dumbbell exercise needs dumbbells picked', () => {
    expect(usableWith(ex({ equipment: 'dumbbell', requires: ['dumbbell'] }), [])).toBe(false);
    expect(usableWith(ex({ equipment: 'dumbbell', requires: ['dumbbell'] }), ['dumbbell'])).toBe(true);
  });
  it('every required kit must be owned', () => {
    const press = ex({ equipment: 'dumbbell', requires: ['dumbbell', 'bench'] });
    expect(usableWith(press, ['dumbbell'])).toBe(false);
    expect(usableWith(press, ['dumbbell', 'bench'])).toBe(true);
  });
  it('a bodyweight exercise that needs a bar is not usable without one', () => {
    const pull = ex({ equipment: 'bodyweight', requires: ['pullup_bar'] });
    expect(usableWith(pull, [])).toBe(false);
    expect(usableWith(pull, ['pullup_bar'])).toBe(true);
  });
  it('kettlebell and band exercises need their own kit', () => {
    expect(usableWith(ex({ equipment: 'kettlebell', requires: ['kettlebell'] }), ['dumbbell'])).toBe(false);
    expect(usableWith(ex({ equipment: 'kettlebell', requires: ['kettlebell'] }), ['kettlebell'])).toBe(true);
    expect(usableWith(ex({ equipment: 'band', requires: ['band'] }), ['band'])).toBe(true);
  });
  it.each(['barbell', 'machine', 'cable', 'other', 'unknown'] as const)('%s is never usable', (equipment) => {
    expect(usableWith(ex({ equipment }), ['dumbbell', 'kettlebell', 'bench', 'pullup_bar', 'band'])).toBe(false);
  });
});

describe('loadKind', () => {
  it('dumbbell equipment or a dumbbell requirement is dumbbell-loaded', () => {
    expect(loadKind(ex({ equipment: 'dumbbell', requires: ['dumbbell'] }))).toBe('dumbbell');
    expect(loadKind(ex({ equipment: 'bodyweight', requires: ['dumbbell'] }))).toBe('dumbbell');
  });
  it('kettlebell equipment is kettlebell-loaded', () => {
    expect(loadKind(ex({ equipment: 'kettlebell', requires: ['kettlebell'] }))).toBe('kettlebell');
  });
  it('bodyweight and band exercises carry no weight', () => {
    expect(loadKind(ex({ equipment: 'bodyweight', requires: [] }))).toBe('none');
    expect(loadKind(ex({ equipment: 'band', requires: ['band'] }))).toBe('none');
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
