// Guards on the bundled catalogue and the source tree (PLAN Phase 2 tests, CLAUDE.md data rules).
import { describe, it, expect } from 'vitest';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { listExercises, getExercise } from './exercises';

const ROOT = join(__dirname, '..', '..');

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

describe('bundled catalogue', () => {
  it('has the 876 free-exercise-db records', () => {
    expect(listExercises()).toHaveLength(876);
  });

  it('every record carries the Unlicense licence and its source', () => {
    for (const ex of listExercises()) {
      expect(ex).toMatchObject({
        source: 'free-exercise-db',
        textSource: 'free-exercise-db',
        license: 'Unlicense',
      });
    }
  });

  it('no record has an images field, and none contains an image path', () => {
    for (const ex of listExercises()) {
      expect('images' in ex).toBe(false);
    }
    const text = readFileSync(join(ROOT, 'src', 'data', 'exercises.json'), 'utf8');
    expect(text).not.toMatch(/\.(jpg|jpeg|png|gif|webp)"/i);
  });

  it('getExercise returns a record by id and undefined for an unknown id', () => {
    const first = listExercises()[0];
    expect(getExercise(first.id)).toBe(first);
    expect(getExercise('fx_does_not_exist')).toBeUndefined();
  });
});

describe('source tree guards', () => {
  it('public/exercises does not exist (no exercise media is shipped)', () => {
    expect(existsSync(join(ROOT, 'public', 'exercises'))).toBe(false);
  });

  it('no animation or video media is committed under src or public', () => {
    const media = [...walk(join(ROOT, 'src')), ...walk(join(ROOT, 'public'))].filter((f) =>
      /\.(gif|mp4|webm|mov)$/i.test(f),
    );
    expect(media.map((f) => relative(ROOT, f))).toEqual([]);
  });

  it('no hotlink to raw GitHub or the image CDNs appears in source', () => {
    // Built at runtime so this file does not match its own pattern.
    const forbidden = new RegExp(['raw\\.githubusercontent\\.com', 'img\\.everkinetic\\.com'].join('|'));
    const sources = walk(join(ROOT, 'src')).filter((f) => !f.endsWith('.test.ts') && !f.endsWith('.test.tsx'));
    const hits = sources.filter((f) => forbidden.test(readFileSync(f, 'utf8')));
    expect(hits.map((f) => relative(ROOT, f))).toEqual([]);
  });
});
