// Muscle groups for XP and ranks (SPEC §4b). The library's muscle names are mapped onto ten groups, which the
// Progress figure shows. Pure: tests cover the mapping and the benchmark lifts.
import { bellsIn } from '../../../domain/dumbbells';
import type { Exercise } from '../../../domain/exercise';

export const GROUPS = [
  'chest',
  'back',
  'shoulders',
  'biceps',
  'triceps',
  'quads',
  'hamstrings',
  'glutes',
  'calves',
  'core',
] as const;
export type Group = (typeof GROUPS)[number];

const RAW_TO_GROUP: Record<string, Group> = {
  chest: 'chest',
  'middle back': 'back',
  'lower back': 'back',
  lats: 'back',
  traps: 'back',
  shoulders: 'shoulders',
  biceps: 'biceps',
  triceps: 'triceps',
  quadriceps: 'quads',
  hamstrings: 'hamstrings',
  glutes: 'glutes',
  calves: 'calves',
  abdominals: 'core',
};

// Unknown names (e.g. forearms) map to no group: they earn no XP.
export function groupOf(rawMuscle: string): Group | null {
  return RAW_TO_GROUP[rawMuscle] ?? null;
}

// One dumbbell lift per group, used for the strength rank. Groups without a dumbbell lift in the library
// (hamstrings, glutes, core) have no benchmark and rank on volume alone.
export const BENCHMARK: Partial<Record<Group, string>> = {
  chest: 'fx_Dumbbell_Bench_Press',
  back: 'fx_One-Arm_Dumbbell_Row',
  shoulders: 'fx_Dumbbell_Shoulder_Press',
  biceps: 'fx_Dumbbell_Bicep_Curl',
  triceps: 'fx_Dumbbell_One-Arm_Triceps_Extension',
  quads: 'fx_Dumbbell_Squat',
  calves: 'fx_Standing_Dumbbell_Calf_Raise',
};

export function isOneArm(ex: Pick<Exercise, 'name'>): boolean {
  return /one[- ]arm/i.test(ex.name);
}

// Bells in use for load: one-arm work uses one bell, otherwise two (dumbbells.ts bellsIn).
export function bellsFor(ex: Pick<Exercise, 'name'>): 1 | 2 {
  return bellsIn(isOneArm(ex));
}
