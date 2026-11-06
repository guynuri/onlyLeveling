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
  source: ExerciseSource;
  textSource: ExerciseSource;
  license: string;
  author: string | null;
  sourceUrl: string | null;
}

// Plans and swaps stay on exercises done with dumbbells or nothing at all until U4 reads the owned equipment.
// A dumbbell exercise that also needs a bench, or a bodyweight one that needs a bar, does not count.
export function isDumbbellCompatible(ex: Pick<Exercise, 'equipment' | 'requires'>): boolean {
  return (ex.equipment === 'dumbbell' || ex.equipment === 'bodyweight') && ex.requires.every((k) => k === 'dumbbell');
}

// Derived from force only. Force null means unknown, shown visibly, never guessed.
export function movementPattern(ex: Pick<Exercise, 'force'>): MovementPattern {
  return ex.force ?? 'unknown';
}
