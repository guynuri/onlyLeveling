// Maps one free-exercise-db record to our Exercise. Pure: the one-off script does the file I/O.
// Unrecognised upstream values throw, so a new value forces a mapping decision instead of a silent guess.
import { movementPattern, type Equipment, type Exercise, type Force, type Level, type Mechanic } from './exercise';

// Shape of dist/exercises.json entries that we read. `images` is read only to be dropped.
export interface FreeExerciseRaw {
  id: string;
  name: string;
  force: string | null;
  level: string;
  mechanic: string | null;
  equipment: string | null;
  category: string;
  primaryMuscles: string[];
  secondaryMuscles: string[];
  instructions: string[];
  images?: string[];
}

const EQUIPMENT: Record<string, Equipment> = {
  barbell: 'barbell',
  'e-z curl bar': 'barbell',
  dumbbell: 'dumbbell',
  kettlebells: 'kettlebell',
  cable: 'cable',
  machine: 'machine',
  'body only': 'bodyweight',
  bands: 'band',
  'medicine ball': 'other',
  'exercise ball': 'other',
  'foam roll': 'other',
  other: 'other',
};

function mapEquipment(v: string | null): Equipment {
  if (v === null) return 'unknown';
  const mapped = EQUIPMENT[v];
  if (!mapped) throw new Error(`Unmapped equipment: ${v}`);
  return mapped;
}

function mapForce(v: string | null): Force | null {
  if (v === null) return null;
  if (v === 'push' || v === 'pull' || v === 'static') return v;
  throw new Error(`Unmapped force: ${v}`);
}

function mapMechanic(v: string | null): Mechanic | null {
  if (v === null) return null;
  if (v === 'compound' || v === 'isolation') return v;
  throw new Error(`Unmapped mechanic: ${v}`);
}

function mapLevel(v: string): Level {
  if (v === 'beginner' || v === 'intermediate' || v === 'expert') return v;
  throw new Error(`Unmapped level: ${v}`);
}

export function mapFreeExercise(raw: FreeExerciseRaw): Exercise {
  const force = mapForce(raw.force);
  return {
    id: `fx_${raw.id}`,
    name: raw.name,
    aliases: [],
    equipment: mapEquipment(raw.equipment),
    force,
    mechanic: mapMechanic(raw.mechanic),
    level: mapLevel(raw.level),
    category: raw.category,
    primaryMuscles: [...raw.primaryMuscles],
    secondaryMuscles: [...raw.secondaryMuscles],
    movementPattern: movementPattern({ force }),
    instructions: [...raw.instructions],
    source: 'free-exercise-db',
    textSource: 'free-exercise-db',
    license: 'Unlicense',
    author: null,
    sourceUrl: 'https://github.com/yuhonas/free-exercise-db',
  };
}
