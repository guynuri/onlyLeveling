// Profile rules for onboarding v2 and settings (UX design §4). Old records have only some fields, so every read goes
// through an accessor here. Pure, tested.
import { GOAL_BLEND, LIMIT_RULES, PROFILE } from '../config/thresholds';
import type { Exercise } from './exercise';
import type { BodySlug } from './muscle-map';
import type { BodyPart, EquipmentChoice, Goal, Settings } from './types';

type Parsed<T> = { ok: true; value: T } | { ok: false; error: string };

export type Step = 'goals' | 'about' | 'experience' | 'days' | 'session' | 'equipment' | 'weights' | 'limits' | 'plan';

export const ALL_STEPS: readonly Step[] = ['goals', 'about', 'experience', 'days', 'session', 'equipment', 'weights', 'limits', 'plan'];
export const V2_STEPS: readonly Step[] = ['goals', 'about', 'equipment', 'weights', 'limits'];

export function goalsOf(s: Settings): Goal[] {
  if (s.goals && s.goals.length > 0) return s.goals;
  return s.goal ? [s.goal] : ['build-muscle'];
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
export function blockedIds(s: Settings, catalogue: readonly Pick<Exercise, 'id' | 'muscles' | 'tags'>[]): Set<string> {
  const out = new Set(s.avoid ?? []);
  const parts = s.limits?.parts ?? [];
  if (parts.length > 0) for (const ex of catalogue) if (excludedByLimits(ex, parts)) out.add(ex.id);
  return out;
}

export function onboardingSteps(s: Settings): Step[] {
  if (!s.onboardedAt) return [...ALL_STEPS];
  return s.onboardedV2At ? [] : [...V2_STEPS];
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
