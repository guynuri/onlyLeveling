// Read API over the catalogue (UX design §3.2): free-exercise-db + RepDB + openGym, merged once at start.
// RepDB comes from a gitignored file the build writes (scripts/fetch-repdb.ts). When it is missing (fresh clone,
// CI tests) the glob is empty and the library is text-only; nothing else changes.
import fxCatalogue from './exercises.json';
import ogCatalogue from './opengym.json';
import type { Exercise } from '../domain/exercise';
import { upgradeFx } from '../domain/exercise-import';
import { lookupExercise, mergeCatalogue } from '../domain/catalogue-merge';
import { ALIASES } from './aliases';

const generated = import.meta.glob<Exercise[]>('./generated/repdb.json', { eager: true, import: 'default' });
const repdb: Exercise[] = Object.values(generated)[0] ?? [];

// The committed fx JSON is model v1; the v2 fields are derived on load (no regenerated file to review).
const fx = (fxCatalogue as unknown as Omit<Exercise, 'requires' | 'mode' | 'muscles'>[]).map(upgradeFx);

const ALL: Exercise[] = mergeCatalogue(fx, repdb, ogCatalogue as unknown as Exercise[], ALIASES);
const BY_ID = new Map(ALL.map((e) => [e.id, e] as const));

export function listExercises(): readonly Exercise[] {
  return ALL;
}

export function getExercise(id: string): Exercise | undefined {
  return lookupExercise(BY_ID, ALIASES, id);
}
