// Exercise model (SPEC §7, DATA_SOURCES §6) and pure rules over it. Phase 2 subset: no images, no custom exercises.

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
  source: 'free-exercise-db';
  textSource: 'free-exercise-db';
  license: 'Unlicense';
  author: string | null;
  sourceUrl: string | null;
}

// Dumbbell-only app (SPEC §1, D9). A movement the user can do with a pair of dumbbells or with no equipment.
export function isDumbbellCompatible(ex: Pick<Exercise, 'equipment'>): boolean {
  return ex.equipment === 'dumbbell' || ex.equipment === 'bodyweight';
}

// Derived from force only. Force null means unknown, shown visibly, never guessed.
export function movementPattern(ex: Pick<Exercise, 'force'>): MovementPattern {
  return ex.force ?? 'unknown';
}
