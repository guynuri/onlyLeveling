import { describe, it, expect } from 'vitest';
import { filterLibrary } from './filter';
import { kitLabel } from './labels';
import type { Exercise } from '../../domain/exercise';

const ex = (id: string, over: Partial<Exercise> = {}): Exercise =>
  ({
    id,
    name: id,
    aliases: [],
    requires: [],
    muscles: { primary: [], secondary: [] },
    ...over,
  }) as Exercise;

const ALL = [
  ex('Bench Press', { equipment: 'dumbbell', requires: ['dumbbell', 'bench'], muscles: { primary: ['chest'], secondary: [] } }),
  ex('Floor Press', { equipment: 'dumbbell', requires: ['dumbbell'], muscles: { primary: ['chest'], secondary: [] } }),
  ex('Push-up', { equipment: 'bodyweight', requires: [], muscles: { primary: ['chest'], secondary: [] }, aliases: ['press-up'] }),
  ex('Pull-up', { equipment: 'bodyweight', requires: ['pullup_bar'], muscles: { primary: ['upper-back'], secondary: [] } }),
  ex('Goblet Squat', { equipment: 'dumbbell', requires: ['dumbbell'], media: { stills: ['x.webp'] }, muscles: { primary: ['quadriceps'], secondary: [] } }),
];

describe('equipment the app does not support', () => {
  const barbell = ex('Barbell Squat', { equipment: 'barbell', requires: [], muscles: { primary: ['quadriceps'], secondary: [] } });

  it('is never "No equipment": hidden whenever any equipment chip is selected', () => {
    expect(filterLibrary([...ALL, barbell], { text: '', kit: ['none', 'dumbbell'], muscle: null }).map((e) => e.name)).not.toContain('Barbell Squat');
  });

  it('still shows when no equipment filter is set', () => {
    expect(filterLibrary([...ALL, barbell], { text: '', kit: [], muscle: null }).map((e) => e.name)).toContain('Barbell Squat');
  });

  it('is labelled by its equipment, not "No equipment"', () => {
    expect(kitLabel(barbell)).toBe('Barbell');
    expect(kitLabel(ALL[2])).toBe('No equipment');
    expect(kitLabel(ALL[0])).toBe('Dumbbells + Bench');
  });
});

const ids = (xs: readonly Exercise[]) => xs.map((e) => e.name);

describe('filterLibrary', () => {
  it('kit: every required item must be selected, so a bench exercise needs Bench too', () => {
    expect(ids(filterLibrary(ALL, { text: '', kit: ['dumbbell'], muscle: null }))).toEqual(['Goblet Squat', 'Floor Press']);
    expect(ids(filterLibrary(ALL, { text: '', kit: ['dumbbell', 'bench'], muscle: null }))).toEqual(['Goblet Squat', 'Bench Press', 'Floor Press']);
  });

  it("'none' selects equipment-free exercises; an empty kit means any", () => {
    expect(ids(filterLibrary(ALL, { text: '', kit: ['none'], muscle: null }))).toEqual(['Push-up']);
    expect(filterLibrary(ALL, { text: '', kit: [], muscle: null })).toHaveLength(5);
  });

  it('muscle matches primary muscles', () => {
    expect(ids(filterLibrary(ALL, { text: '', kit: [], muscle: 'chest' }))).toEqual(['Bench Press', 'Floor Press', 'Push-up']);
  });

  it('text matches the name or an alias, ignoring case', () => {
    expect(ids(filterLibrary(ALL, { text: 'PRESS-UP', kit: [], muscle: null }))).toEqual(['Push-up']);
    expect(ids(filterLibrary(ALL, { text: 'pull', kit: [], muscle: null }))).toEqual(['Pull-up']);
  });

  it('exercises with pictures come first, then by name', () => {
    expect(ids(filterLibrary(ALL, { text: '', kit: [], muscle: null }))[0]).toBe('Goblet Squat');
  });
});
