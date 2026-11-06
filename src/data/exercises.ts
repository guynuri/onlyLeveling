// Read API over the bundled catalogue. The only module that imports exercises.json (PLAN Phase 2).
import catalogue from './exercises.json';
import type { Exercise } from '../domain/exercise';
import { upgradeFx } from '../domain/exercise-import';

// The committed JSON is model v1; the v2 fields are derived on load (no regenerated file to review).
const ALL: Exercise[] = (catalogue as unknown as Omit<Exercise, 'requires' | 'mode' | 'muscles'>[]).map(upgradeFx);
const BY_ID = new Map(ALL.map((e) => [e.id, e] as const));

export function listExercises(): readonly Exercise[] {
  return ALL;
}

export function getExercise(id: string): Exercise | undefined {
  return BY_ID.get(id);
}
