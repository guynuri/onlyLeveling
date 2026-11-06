// Fixtures here are made up in RepDB's and openGym's shapes. No real RepDB data is committed (CLAUDE.md).
import { describe, it, expect } from 'vitest';
import { mapRepdb, mapOpengym, normaliseName, mergeCatalogue, type RepdbRaw, type OpengymRaw } from './catalogue-merge';
import { upgradeFx } from './exercise-import';
import type { Exercise } from './exercise';

const BASE = 'media/repdb/';

const rp = (over: Partial<RepdbRaw>): RepdbRaw => ({
  id: 'test-press',
  name_en: 'Test Press',
  category: 'strength',
  force_type: 'push',
  mechanic: 'compound',
  difficulty: 'beginner',
  equipment: 'dumbbell',
  primary_muscles: ['pectoralis_major'],
  secondary_muscles: ['triceps_brachii'],
  instructions_en: ['Push.'],
  tips_en: ['Breathe.'],
  description_en: 'A made-up press.',
  images: { flat: { start: 'images/flat/test-press-start.webp', peak: 'images/flat/test-press-peak.webp' } },
  ...over,
});

const og = (over: Partial<OpengymRaw>): OpengymRaw => ({
  id: '9001',
  name: 'made up dumbbell row',
  equipment: 'dumbbell',
  target: 'lats',
  secondaryMuscles: ['biceps'],
  category: 'strength',
  instructions: ['Pull.'],
  textSource: 'opengym',
  muscleMap: { primaries: ['upper-back'], secondaries: ['biceps', 'not-a-slug'] },
  ...over,
});

const fx = (id: string, name: string): Exercise =>
  upgradeFx({
    id,
    name,
    aliases: [],
    equipment: 'dumbbell',
    force: 'push',
    mechanic: 'compound',
    level: 'beginner',
    category: 'strength',
    primaryMuscles: ['chest'],
    secondaryMuscles: [],
    movementPattern: 'push',
    instructions: ['fx text'],
    source: 'free-exercise-db',
    textSource: 'free-exercise-db',
    license: 'Unlicense',
    author: null,
    sourceUrl: null,
  });

describe('mapRepdb', () => {
  it('drops equipment the app does not support', () => {
    expect(mapRepdb(rp({ equipment: 'barbell' }), BASE)).toBeNull();
  });

  it('maps a pull-up bar and a requires_bench tag to kit', () => {
    expect(mapRepdb(rp({ equipment: 'pull_up_bar' }), BASE)?.requires).toEqual(['pullup_bar']);
    expect(mapRepdb(rp({ tags: ['requires_bench'] }), BASE)?.requires).toEqual(['dumbbell', 'bench']);
    expect(mapRepdb(rp({ equipment: null }), BASE)?.requires).toEqual([]);
  });

  it('start and peak become two stills under the base; main becomes one', () => {
    expect(mapRepdb(rp({}), BASE)?.media?.stills).toEqual([`${BASE}test-press-start.webp`, `${BASE}test-press-peak.webp`]);
    expect(mapRepdb(rp({ images: { flat: { main: 'images/flat/test-press.webp' } } }), BASE)?.media?.stills).toEqual([
      `${BASE}test-press.webp`,
    ]);
  });

  it('muscles are in free-exercise names for XP and in body slugs for the map', () => {
    const e = mapRepdb(rp({}), BASE)!;
    expect(e.id).toBe('rp_test-press');
    expect(e.primaryMuscles).toEqual(['chest']);
    expect(e.muscles).toEqual({ primary: ['chest'], secondary: ['triceps'] });
    expect(e.source).toBe('repdb');
  });

  it('a stretch is a timed exercise', () => {
    expect(mapRepdb(rp({ category: 'stretching' }), BASE)?.mode).toBe('time');
  });
});

describe('mapOpengym', () => {
  it('drops variant stubs and non-dumbbell entries', () => {
    expect(mapOpengym({ id: '1', variantOf: '2' })).toBeNull();
    expect(mapOpengym(og({ equipment: 'cable' }))).toBeNull();
  });

  it('maps needs, holds, ids and muscles', () => {
    const e = mapOpengym(og({ needs: ['bench'], hold: true }))!;
    expect(e.id).toBe('og_9001');
    expect(e.requires).toEqual(['dumbbell', 'bench']);
    expect(e.mode).toBe('time');
    expect(e.muscles).toEqual({ primary: ['upper-back'], secondary: ['biceps'] });
    expect(e.primaryMuscles).toEqual(['lats']);
    expect(e.name).toBe('Made Up Dumbbell Row');
  });
});

describe('normaliseName', () => {
  it('treats dumbbell plurals, punctuation and case alike', () => {
    expect(normaliseName('Dumbbells Bench-Press')).toBe(normaliseName('dumbbell bench press'));
  });
});

describe('mergeCatalogue', () => {
  it('a RepDB match keeps the fx id and name and gains the pictures', () => {
    const out = mergeCatalogue([fx('fx_DB_Press', 'Dumbbell Bench Press')], [mapRepdb(rp({ id: 'db-press', name_en: 'Dumbbell Bench Press' }), BASE)!], [], {});
    expect(out).toHaveLength(1);
    expect(out[0].id).toBe('fx_DB_Press');
    expect(out[0].instructions).toEqual(['fx text']);
    expect(out[0].media?.stills).toHaveLength(2);
    expect(out[0].tips).toEqual(['Breathe.']);
  });

  it('an alias links differently named records', () => {
    const out = mergeCatalogue([fx('fx_A', 'Flat Press')], [mapRepdb(rp({ id: 'other-name' }), BASE)!], [], { 'rp_other-name': 'fx_A' });
    expect(out.map((e) => e.id)).toEqual(['fx_A']);
    expect(out[0].media).toBeDefined();
  });

  it('an unmatched RepDB record is added with its rp_ id', () => {
    const out = mergeCatalogue([fx('fx_A', 'Something Else')], [mapRepdb(rp({}), BASE)!], [], {});
    expect(out.map((e) => e.id)).toEqual(['fx_A', 'rp_test-press']);
  });

  it('an openGym record whose name is already in is dropped; a new one is added', () => {
    const out = mergeCatalogue([fx('fx_A', 'Made Up Dumbbell Row')], [], [mapOpengym(og({}))!, mapOpengym(og({ id: '9002', name: 'new curl' }))!], {});
    expect(out.map((e) => e.id)).toEqual(['fx_A', 'og_9002']);
  });
});
