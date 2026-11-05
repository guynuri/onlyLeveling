// Read API over the bundled catalogue. The only module that imports exercises.json (PLAN Phase 2).
import catalogue from './exercises.json';
import type { Exercise } from '../domain/exercise';

const ALL = catalogue as Exercise[];
const BY_ID = new Map(ALL.map((e) => [e.id, e] as const));

export function listExercises(): readonly Exercise[] {
  return ALL;
}

export function getExercise(id: string): Exercise | undefined {
  return BY_ID.get(id);
}
