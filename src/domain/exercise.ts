// Exercise model (SPEC §7, DATA_SOURCES §6; UX design §3) and pure rules over it. No custom exercises yet.
import type { BodySlug } from './muscle-map';

// Equipment an exercise needs beyond the floor (UX design §3.3). Empty = no equipment.
export type Kit = 'dumbbell' | 'kettlebell' | 'bench' | 'pullup_bar' | 'band';
export type ExerciseSource = 'free-exercise-db' | 'repdb' | 'opengym';

export type Equipment =
  | 'barbell'
  | 'dumbbell'
  | 'kettlebell'
  | 'cable'
  | 'machine'
  | 'bodyweight'
  | 'band'
  | 'other'
  | 'unknown';
export type Force = 'push' | 'pull' | 'static';
export type Mechanic = 'compound' | 'isolation';
export type Level = 'beginner' | 'intermediate' | 'expert';
// PLAN Phase 2: only what the upstream force field can decide. squat/hinge are never derived (SPEC §11 item 7).
export type MovementPattern = 'push' | 'pull' | 'static' | 'unknown';

export interface Exercise {
  id: string;
  name: string;
  aliases: string[];
  equipment: Equipment;
  force: Force | null;
  mechanic: Mechanic | null;
  level: Level | null;
  category: string;
  primaryMuscles: string[];
  secondaryMuscles: string[];
  movementPattern: MovementPattern;
  instructions: string[];
  requires: Kit[];
  mode: 'reps' | 'time'; // time: holds, stretches, mobility (UX design §3.3)
  muscles: { primary: BodySlug[]; secondary: BodySlug[] }; // body-map slugs; XP still reads primaryMuscles
  media?: { stills: string[]; clip?: string }; // paths relative to the app base
  description?: string;
  tips?: string[];
  unilateral?: boolean;
  variationGroup?: string;
  tags?: string[];
  extrasFrom?: 'repdb'; // a free-exercise-db record that took RepDB's description, tips or pictures (credit line)
  source: ExerciseSource;
  textSource: ExerciseSource;
  license: string;
  author: string | null;
  sourceUrl: string | null;
}

// Needs nothing at all. `requires` is empty for barbell, cable and machine records too (no Kit for them), so the
// equipment field decides.
export function isEquipmentFree(ex: Pick<Exercise, 'equipment' | 'requires'>): boolean {
  return ex.equipment === 'bodyweight' && ex.requires.length === 0;
}

// Usable with what the user owns: equipment-free exercises always; dumbbell, kettlebell and band exercises when that
// kit is owned; every kit in `requires` must be owned too. Barbell, cable, machine, other and unknown never are.
export function usableWith(ex: Pick<Exercise, 'equipment' | 'requires'>, equipment: readonly Kit[]): boolean {
  if (!ex.requires.every((k) => equipment.includes(k))) return false;
  if (ex.equipment === 'bodyweight') return true;
  return (ex.equipment === 'dumbbell' || ex.equipment === 'kettlebell' || ex.equipment === 'band') && equipment.includes(ex.equipment);
}

// What the weight means for an exercise: owned dumbbell or kettlebell weights, or none (bands, bodyweight).
export function loadKind(ex: Pick<Exercise, 'equipment' | 'requires'>): 'dumbbell' | 'kettlebell' | 'none' {
  if (ex.equipment === 'dumbbell' || ex.requires.includes('dumbbell')) return 'dumbbell';
  if (ex.equipment === 'kettlebell' || ex.requires.includes('kettlebell')) return 'kettlebell';
  return 'none';
}

// Derived from force only. Force null means unknown, shown visibly, never guessed.
export function movementPattern(ex: Pick<Exercise, 'force'>): MovementPattern {
  return ex.force ?? 'unknown';
}
