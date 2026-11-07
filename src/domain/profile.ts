// Profile rules for onboarding v2 and settings (UX design §4). Old records have only some fields, so every read goes
// through an accessor here. Pure, tested.
import { GOAL_BLEND, LIMIT_RULES, PROFILE } from '../config/thresholds';
import type { Exercise } from './exercise';
import type { BodySlug } from './muscle-map';
import type { BodyPart, EquipmentChoice, Goal, Settings } from './types';
import { DIFFICULTY_LOCK } from '../config/thresholds';
import { groupOf, type Group } from '../modules/xp/domain/muscles';
import { rankAtLeast, type Rank } from '../modules/xp/domain/rank';

type Parsed<T> = { ok: true; value: T } | { ok: false; error: string };

export type Step = 'goals' | 'focus' | 'about' | 'experience' | 'days' | 'session' | 'equipment' | 'weights' | 'limits' | 'plan';

export const ALL_STEPS: readonly Step[] = ['goals', 'focus', 'about', 'experience', 'days', 'session', 'equipment', 'weights', 'limits', 'plan'];

export function goalsOf(s: Settings): Goal[] {
  if (s.goals && s.goals.length > 0) return s.goals;
  return s.goal ? [s.goal] : ['build-muscle'];
}

export function workoutViewOf(s: Settings): 'focus' | 'list' {
  return s.workoutView ?? 'focus';
}

export function equipmentOf(s: Settings): EquipmentChoice[] {
  if (s.equipment) return s.equipment;
  return s.owned.length > 0 ? ['dumbbell'] : [];
}

export interface GoalBlend {
  cardioSessions: number;
  cardioMinutes: number;
  mobilityMinutes: number;
  repBias: 'none' | 'heavier' | 'lighter';
}

// Equal weight: each number is the most any goal asks for. Strength and endurance pull reps opposite ways, so
// together they cancel.
export function blendGoals(goals: readonly Goal[]): GoalBlend {
  const rows = goals.map((g) => GOAL_BLEND[g]);
  const most = (k: 'cardioSessions' | 'cardioMinutes' | 'mobilityMinutes') => Math.max(0, ...rows.map((r) => r[k]));
  const heavier = goals.includes('strength');
  const lighter = goals.includes('endurance');
  return {
    cardioSessions: most('cardioSessions'),
    cardioMinutes: most('cardioMinutes'),
    mobilityMinutes: most('mobilityMinutes'),
    repBias: heavier === lighter ? 'none' : heavier ? 'heavier' : 'lighter',
  };
}

export function excludedByLimits(ex: Pick<Exercise, 'muscles' | 'tags'>, parts: readonly BodyPart[]): boolean {
  return parts.some((p) => {
    const rule: { slugs: readonly string[]; safeTag?: string } = LIMIT_RULES[p];
    if (rule.safeTag && ex.tags?.includes(rule.safeTag)) return false;
    return ex.muscles.primary.some((m: BodySlug) => rule.slugs.includes(m));
  });
}

// Everything plans, swaps and the AI must not offer: the avoid list plus what the limits rule out.
// The rank an exercise needs under the difficulty lock, or null when it is open: beginner and unknown levels always
// are; otherwise every XP group of its primary muscles must have reached DIFFICULTY_LOCK[level].
export function lockedUntil(ex: Pick<Exercise, 'level' | 'primaryMuscles'>, ranks: Readonly<Partial<Record<Group, Rank>>>): Rank | null {
  if (ex.level !== 'intermediate' && ex.level !== 'expert') return null;
  const need: Rank = DIFFICULTY_LOCK[ex.level];
  const groups = ex.primaryMuscles.map(groupOf).filter((g): g is Group => g !== null);
  return groups.some((g) => !rankAtLeast(ranks[g] ?? 'F', need)) ? need : null;
}

// Exercises plans, swaps and the AI must not use: the avoid list, the limits, and (when the lock is on) exercises
// harder than the user's muscle ranks allow. `ranks` missing counts every muscle as F.
export function blockedIds(
  s: Settings,
  catalogue: readonly Pick<Exercise, 'id' | 'muscles' | 'tags' | 'level' | 'primaryMuscles'>[],
  ranks: Readonly<Partial<Record<Group, Rank>>> = {},
): Set<string> {
  const out = new Set(s.avoid ?? []);
  const parts = s.limits?.parts ?? [];
  if (parts.length > 0) for (const ex of catalogue) if (excludedByLimits(ex, parts)) out.add(ex.id);
  if (s.lockByRank) for (const ex of catalogue) if (lockedUntil(ex, ranks)) out.add(ex.id);
  return out;
}

// Onboarding is finished only when the v2 run reached its last step (the plan). Anything else, older accounts
// included, starts it again from the top (owner decision: test-stage data need not be kept).
export function onboardingDone(s: Settings): boolean {
  return !!s.onboardedV2At;
}

// A weight the user types in, for bells the grid does not list (e.g. 11.25 kg). Commas count as decimal points.
export function addWeight(list: readonly number[], text: string): Parsed<number[]> {
  const t = text.trim().replace(',', '.');
  const n = Number(t);
  if (t === '' || !Number.isFinite(n) || n <= 0 || n > PROFILE.maxCustomWeightKg) {
    return { ok: false, error: `Enter a weight in kg, more than 0 and up to ${PROFILE.maxCustomWeightKg}.` };
  }
  return { ok: true, value: [...new Set([...list, n])].sort((a, b) => a - b) };
}

const RANGE_NAME = { age: 'Age', heightCm: 'Height (cm)', weightKg: 'Weight (kg)' } as const;

function num(text: string, key: keyof typeof RANGE_NAME): Parsed<number | null> {
  const t = text.trim();
  if (t === '') return { ok: true, value: null };
  const n = Number(t);
  const [lo, hi] = PROFILE.about[key];
  if (!Number.isFinite(n) || n < lo || n > hi) return { ok: false, error: `${RANGE_NAME[key]} must be between ${lo} and ${hi}, or left empty.` };
  return { ok: true, value: n };
}

// About you is optional: blanks are fine and store nothing.
export function parseAbout(f: { sex: string; age: string; heightCm: string; weightKg: string }): Parsed<{
  about: NonNullable<Settings['about']>;
  weightKg: number | null;
}> {
  const age = num(f.age, 'age');
  if (!age.ok) return age;
  const height = num(f.heightCm, 'heightCm');
  if (!height.ok) return height;
  const weight = num(f.weightKg, 'weightKg');
  if (!weight.ok) return weight;
  const about: NonNullable<Settings['about']> = {};
  if (f.sex === 'male' || f.sex === 'female') about.sex = f.sex;
  if (age.value !== null) about.age = Math.round(age.value);
  if (height.value !== null) about.heightCm = height.value;
  return { ok: true, value: { about, weightKg: weight.value } };
}

// Progression needs at least one weight for every kind of bell the user said they own.
export function validateWeights(equipment: readonly EquipmentChoice[], owned: readonly number[], kettlebells: readonly number[]): string | null {
  if (equipment.includes('dumbbell') && owned.length === 0) return 'Pick at least one dumbbell weight you own.';
  if (equipment.includes('kettlebell') && kettlebells.length === 0) return 'Pick at least one kettlebell weight you own.';
  return null;
}
