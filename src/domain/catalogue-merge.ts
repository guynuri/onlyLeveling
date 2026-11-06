// The catalogue merge (UX design §3.2): free-exercise-db (committed) + RepDB (fetched at build, never committed) +
// openGym text (committed). Pure: scripts and the app pass the data in. Tested with made-up fixtures.
import { movementPattern, type Equipment, type Exercise, type Force, type Kit, type Level, type Mechanic } from './exercise';
import { isBodySlug, OG_TARGET_TO_FX, REPDB_TO_FX, REPDB_TO_SLUG, slugsOf, type BodySlug } from './muscle-map';

export interface RepdbRaw {
  id: string;
  name_en: string;
  description_en?: string;
  category: string;
  force_type?: string;
  mechanic?: string;
  difficulty?: string;
  equipment?: string | null;
  primary_muscles?: string[];
  secondary_muscles?: string[];
  is_unilateral?: boolean;
  is_bodyweight?: boolean;
  instructions_en?: string[];
  tips_en?: string[];
  tags?: string[];
  variation_group?: string;
  images: { flat?: { start?: string; peak?: string; main?: string } };
}

export interface OpengymRaw {
  id: string;
  name?: string;
  equipment?: string | null;
  target?: string;
  secondaryMuscles?: string[];
  category?: string;
  description?: string;
  instructions?: string[];
  needs?: string[];
  hold?: boolean;
  variantOf?: string;
  textSource?: string;
  muscleMap?: { primaries: string[]; secondaries: string[] };
}

// RepDB equipment → kit; null = equipment the app does not support (barbells, machines, …), dropped.
export const REPDB_KIT: Readonly<Record<string, Kit[] | null>> = {
  dumbbell: ['dumbbell'],
  kettlebell: ['kettlebell'],
  pull_up_bar: ['pullup_bar'],
  flat_bench: ['bench'],
  loop_band: ['band'],
  resistance_band: ['band'],
};

// RepDB leaves the key out (or sets null) for equipment-free exercises.
function repdbKit(eq: string | null | undefined): Kit[] | null {
  if (eq == null) return [];
  return REPDB_KIT[eq] ?? null;
}

// The single equipment label the library shows; the full need is in `requires`.
function equipmentOf(kit: readonly Kit[]): Equipment {
  if (kit.includes('dumbbell')) return 'dumbbell';
  if (kit.includes('kettlebell')) return 'kettlebell';
  if (kit.includes('band')) return 'band';
  return 'bodyweight';
}

const uniq = <T>(xs: readonly T[]): T[] => [...new Set(xs)];

function force(v: string | undefined): Force | null {
  return v === 'push' || v === 'pull' || v === 'static' ? v : null;
}
function mechanic(v: string | undefined): Mechanic | null {
  return v === 'compound' || v === 'isolation' ? v : null;
}
function level(v: string | undefined): Level | null {
  if (v === 'beginner' || v === 'intermediate') return v;
  return v === 'advanced' ? 'expert' : null;
}

const stripImages = (p: string) => p.replace(/^images\/flat\//, '');

export function mapRepdb(raw: RepdbRaw, mediaBase: string): Exercise | null {
  const kit = repdbKit(raw.equipment);
  if (kit === null) return null;
  const requires = uniq<Kit>([...kit, ...(raw.tags?.includes('requires_bench') ? (['bench'] as const) : [])]);
  const prim = raw.primary_muscles ?? [];
  const sec = raw.secondary_muscles ?? [];
  const flat = raw.images.flat ?? {};
  const stills = flat.start && flat.peak ? [flat.start, flat.peak] : flat.main ? [flat.main] : [];
  const f = force(raw.force_type);
  return {
    id: `rp_${raw.id}`,
    name: raw.name_en,
    aliases: [],
    equipment: equipmentOf(requires),
    force: f,
    mechanic: mechanic(raw.mechanic),
    level: level(raw.difficulty),
    category: raw.category,
    primaryMuscles: uniq(prim.map((m) => REPDB_TO_FX[m]).filter(Boolean)),
    secondaryMuscles: uniq(sec.map((m) => REPDB_TO_FX[m]).filter(Boolean)),
    movementPattern: movementPattern({ force: f }),
    instructions: raw.instructions_en ?? [],
    requires,
    mode: raw.category === 'stretching' ? 'time' : 'reps',
    muscles: {
      primary: uniq(prim.map((m) => REPDB_TO_SLUG[m]).filter(Boolean)),
      secondary: uniq(sec.map((m) => REPDB_TO_SLUG[m]).filter(Boolean)),
    },
    ...(stills.length > 0 ? { media: { stills: stills.map((s) => mediaBase + stripImages(s)) } } : {}),
    ...(raw.description_en ? { description: raw.description_en } : {}),
    ...(raw.tips_en?.length ? { tips: raw.tips_en } : {}),
    ...(raw.is_unilateral !== undefined ? { unilateral: raw.is_unilateral } : {}),
    ...(raw.variation_group ? { variationGroup: raw.variation_group } : {}),
    ...(raw.tags?.length ? { tags: raw.tags } : {}),
    source: 'repdb',
    textSource: 'repdb',
    license: 'RepDB Free Tier License v1.0',
    author: 'RepDB',
    sourceUrl: 'https://repdb.co',
  };
}

const OG_NEEDS: Readonly<Record<string, Kit>> = { bench: 'bench', 'pull-up bar': 'pullup_bar' };

const titleCase = (s: string) => s.replace(/\b\w/g, (c) => c.toUpperCase());

export function mapOpengym(raw: OpengymRaw): Exercise | null {
  if (raw.variantOf || raw.equipment !== 'dumbbell' || !raw.name) return null;
  const primaryMuscles = uniq([raw.target ?? ''].map((m) => OG_TARGET_TO_FX[m]).filter(Boolean));
  const secondaryMuscles = uniq((raw.secondaryMuscles ?? []).map((m) => OG_TARGET_TO_FX[m]).filter(Boolean));
  const slugs = (xs: readonly string[]): BodySlug[] => uniq(xs.filter(isBodySlug));
  return {
    id: `og_${raw.id}`,
    name: titleCase(raw.name),
    aliases: [],
    equipment: 'dumbbell',
    force: null,
    mechanic: null,
    level: null,
    category: raw.category ?? 'strength',
    primaryMuscles,
    secondaryMuscles,
    movementPattern: 'unknown',
    instructions: raw.instructions ?? [],
    requires: uniq<Kit>(['dumbbell', ...(raw.needs ?? []).map((n) => OG_NEEDS[n]).filter(Boolean)]),
    mode: raw.hold ? 'time' : 'reps',
    muscles: raw.muscleMap
      ? { primary: slugs(raw.muscleMap.primaries), secondary: slugs(raw.muscleMap.secondaries) }
      : { primary: slugsOf(primaryMuscles), secondary: slugsOf(secondaryMuscles) },
    ...(raw.description ? { description: raw.description } : {}),
    source: 'opengym',
    textSource: 'opengym',
    license: raw.textSource === 'exercisedb' ? 'MIT (ExerciseDB text)' : 'AGPL-3.0 (openGym)',
    author: raw.textSource === 'exercisedb' ? 'ExerciseDB / AscendAPI' : 'openGym contributors',
    sourceUrl: 'https://github.com/DuarteSantos8/openGym',
  };
}

// Ids never die (UX design §3.2): an rp_ id that an alias later merged into an fx record still finds that record,
// so logged workouts and plans that hold it keep working.
export function lookupExercise(
  byId: ReadonlyMap<string, Exercise>,
  aliases: Readonly<Record<string, string>>,
  id: string,
): Exercise | undefined {
  return byId.get(id) ?? (aliases[id] !== undefined ? byId.get(aliases[id]) : undefined);
}

// Name key for de-duplication: case, punctuation, "dumbbells"/"dumbbell" and filler words do not matter.
export function normaliseName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .split(' ')
    .filter((w) => w && w !== 'the' && w !== 'a')
    .map((w) => (w === 'dumbbells' ? 'dumbbell' : w))
    .join(' ');
}

// fx records keep their id, name, text and source; a RepDB match adds its pictures and extras. Unmatched RepDB
// records are added; openGym records are added only when nothing with the same name is in yet.
export function mergeCatalogue(
  fx: readonly Exercise[],
  repdb: readonly Exercise[],
  og: readonly Exercise[],
  aliases: Readonly<Record<string, string>>,
): Exercise[] {
  const out = fx.map((e) => ({ ...e }));
  const byName = new Map(out.map((e, i) => [normaliseName(e.name), i] as const));
  const byId = new Map(out.map((e, i) => [e.id, i] as const));
  for (const r of repdb) {
    // A name match counts only with the same equipment: RepDB's kettlebell goblet squat is not our dumbbell one.
    // An alias is an explicit decision and needs no check.
    const byNameHit = byName.get(normaliseName(r.name));
    const i =
      aliases[r.id] !== undefined
        ? byId.get(aliases[r.id])
        : byNameHit !== undefined && out[byNameHit].equipment === r.equipment
          ? byNameHit
          : undefined;
    if (i === undefined) {
      byName.set(normaliseName(r.name), out.length);
      out.push(r);
      continue;
    }
    const { media, tips, description, unilateral, variationGroup, tags, muscles, requires } = r;
    out[i] = {
      ...out[i],
      extrasFrom: 'repdb',
      requires,
      muscles,
      ...(media ? { media } : {}),
      ...(tips ? { tips } : {}),
      ...(description ? { description } : {}),
      ...(unilateral !== undefined ? { unilateral } : {}),
      ...(variationGroup ? { variationGroup } : {}),
      ...(tags ? { tags } : {}),
    };
  }
  for (const o of og) {
    const key = normaliseName(o.name);
    if (byName.has(key)) continue;
    byName.set(key, out.length);
    out.push(o);
  }
  return out;
}
