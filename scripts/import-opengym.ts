// One-off import: openGym catalogue text → src/data/opengym.json (committed). Text only: never catalogue/media.
// Usage: npx tsx scripts/import-opengym.ts <path-to-opengym/catalogue/exercises>
// Keeps dumbbell exercises that are not variant stubs (catalogue-merge.ts mapOpengym). Names already in the
// free-exercise-db catalogue are dropped later, at merge time.
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mapOpengym, type OpengymRaw } from '../src/domain/catalogue-merge';
import type { Exercise } from '../src/domain/exercise';

const dir = process.argv[2];
if (!dir) {
  console.error('Usage: npx tsx scripts/import-opengym.ts <path-to-opengym/catalogue/exercises>');
  process.exit(1);
}

const out: Exercise[] = readdirSync(dir)
  .filter((f) => f.endsWith('.json'))
  .map((f) => mapOpengym(JSON.parse(readFileSync(join(dir, f), 'utf8')) as OpengymRaw))
  .filter((e): e is Exercise => e !== null)
  .sort((a, b) => a.id.localeCompare(b.id));

const target = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'data', 'opengym.json');
writeFileSync(target, JSON.stringify(out) + '\n');
console.log(`wrote ${out.length} openGym exercises to ${target}`);
