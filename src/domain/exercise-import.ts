// Maps one free-exercise-db record to our Exercise. Pure: the one-off script does the file I/O.
// Unrecognised upstream values throw, so a new value forces a mapping decision instead of a silent guess.
import { movementPattern, type Equipment, type Exercise, type Force, type Kit, type Level, type Mechanic } from './exercise';
import { slugsOf } from './muscle-map';

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

// Kit implied by free-exercise-db's single equipment value, plus a bench or a pull-up bar when the name says so:
// upstream does not record them, and without this a swap could suggest an exercise needing kit the user lacks.
const NEEDS_BENCH = /\bbench\b|\bincline\b|\bdecline\b|\bpreacher\b/i;
const NEEDS_BAR = /\bpull[- ]?ups?\b|\bchin[- ]?ups?\b|\bhanging\b|\bmuscle[- ]?ups?\b/i;
const NO_BENCH = /\bpush[- ]?ups?\b|\bno\b.*\bbench\b/i; // incline push-ups use any step; \"with no bench\" says so

export function kitOf(equipment: Equipment, name = ''): Kit[] {
  const kit: Kit[] = equipment === 'dumbbell' || equipment === 'kettlebell' || equipment === 'band' ? [equipment] : [];
  if (NEEDS_BENCH.test(name) && !NO_BENCH.test(name)) kit.push('bench');
  if (NEEDS_BAR.test(name)) kit.push('pullup_bar');
  return kit;
}

// The fields added in exercise model v2, derived from the v1 ones. Used by the importer and when the committed
// v1 JSON is loaded.
export function upgradeFx(ex: Omit<Exercise, 'requires' | 'mode' | 'muscles'>): Exercise {
  return {
    ...ex,
    requires: kitOf(ex.equipment, ex.name),
    mode: ex.category === 'stretching' ? 'time' : 'reps',
    muscles: { primary: slugsOf(ex.primaryMuscles), secondary: slugsOf(ex.secondaryMuscles) },
  };
}

export function mapFreeExercise(raw: FreeExerciseRaw): Exercise {
  const force = mapForce(raw.force);
  return upgradeFx({
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
  });
}
