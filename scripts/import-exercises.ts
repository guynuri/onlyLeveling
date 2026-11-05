// One-off import: free-exercise-db dist/exercises.json → src/data/exercises.json (committed).
// Usage: npx tsx scripts/import-exercises.ts <path-to-exercises.json>
// Copies no images (DATA_SOURCES §1: free-exercise-db images have no licence). Run by hand, never in the browser.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mapFreeExercise, type FreeExerciseRaw } from '../src/domain/exercise-import';

const input = process.argv[2];
if (!input) {
  console.error('Usage: npx tsx scripts/import-exercises.ts <path-to-exercises.json>');
  process.exit(1);
}

const raw = JSON.parse(readFileSync(input, 'utf8')) as FreeExerciseRaw[];
const exercises = raw
  .map((r) => mapFreeExercise(r))
  .sort((a, b) => a.id.localeCompare(b.id));

const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, '..', 'src', 'data', 'exercises.json');
// Compact on purpose: the file is bundled into the app, and it is generated, so diffs are not read by hand.
writeFileSync(out, JSON.stringify(exercises) + '\n');
console.log(`wrote ${exercises.length} exercises to ${out}`);
