// Build-time fetch of the RepDB free tier (CLAUDE.md data table, UX design §3.1). Run by `npm run media` and by the
// deploy workflow before `vite build`. Never commit what it writes: both outputs are gitignored.
//   src/data/generated/repdb.json  — the supported exercises, already mapped to our model (English only)
//   public/media/repdb/*.webp      — their start/peak pictures, served as individual app files
// The commit is pinned and the JSON checked by SHA-256, so a build never picks up data nobody reviewed.
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mapRepdb, type RepdbRaw } from '../src/domain/catalogue-merge';
import type { Exercise } from '../src/domain/exercise';

const COMMIT = '66c4298af8d99b9dc397dad6699e508fb871d249';
const JSON_SHA256 = 'ecaeece74163382d74d0082639cee83b466dec5c3e2430efaf327e3dd5357443';
const RAW = `https://raw.githubusercontent.com/RepDB/exercise-dataset/${COMMIT}/`;
const MEDIA_BASE = 'media/repdb/'; // relative to the app base; matches the service worker's cache rule

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const jsonOut = join(root, 'src', 'data', 'generated', 'repdb.json');
const mediaDir = join(root, 'public', 'media', 'repdb');

async function get(url: string): Promise<Buffer> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return Buffer.from(await res.arrayBuffer());
}

async function main() {
  const body = await get(RAW + 'exercises.json');
  const sha = createHash('sha256').update(body).digest('hex');
  if (sha !== JSON_SHA256) throw new Error(`RepDB exercises.json checksum ${sha} does not match the pinned ${JSON_SHA256}`);

  const raw = (JSON.parse(body.toString('utf8')) as { exercises: RepdbRaw[] }).exercises;
  const mapped = raw.map((r) => mapRepdb(r, MEDIA_BASE)).filter((e): e is Exercise => e !== null);
  mkdirSync(dirname(jsonOut), { recursive: true });
  writeFileSync(jsonOut, JSON.stringify(mapped) + '\n');

  mkdirSync(mediaDir, { recursive: true });
  const files = mapped.flatMap((e) => e.media?.stills ?? []).map((p) => p.slice(MEDIA_BASE.length));
  const todo = files.filter((f) => !existsSync(join(mediaDir, f)));
  let next = 0;
  const failed: string[] = [];
  const worker = async () => {
    while (next < todo.length) {
      const f = todo[next++];
      try {
        writeFileSync(join(mediaDir, f), await get(`${RAW}images/flat/${f}`));
      } catch {
        failed.push(f);
      }
    }
  };
  await Promise.all(Array.from({ length: 8 }, worker));
  if (failed.length > 0) throw new Error(`${failed.length} pictures failed to download, e.g. ${failed.slice(0, 3).join(', ')}`);
  console.log(`RepDB: ${mapped.length} exercises, ${files.length} pictures (${todo.length} downloaded)`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
