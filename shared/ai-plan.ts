// Validation of an AI-proposed first plan (SPEC §5.4, §5.5). Pure, shared by the Worker (retry decision) and the app
// (copy-paste fallback). The AI is never trusted for numbers: every value is checked here, and out-of-range numbers are
// corrected and reported, never silently passed on.
import { ownedFloor } from '../src/domain/dumbbells';
import { ROUTINE, SUPERSET } from '../src/config/thresholds';

export const AI_PLAN_LIMITS = {
  nameMax: 60,
  reasonMax: 200,
  noteMax: 400,
  setsMin: 1,
  setsMax: 5,
  repsMax: 50,
} as const;

// One library exercise as the validator sees it. The app builds these from the catalogue (dumbbell-compatible only).
export interface Candidate {
  name: string;
  repMin: number;
  repMax: number;
  // The weights this exercise can be loaded with. Omitted: the plan's `owned` dumbbells (older apps). null: no weight
  // (bands, bodyweight), so `w` must be 0. A list: snap to it.
  loads?: readonly number[] | null;
}

export interface PlanInput {
  daysPerWeek: number;
  exercisesPerDay: number;
  owned: readonly number[]; // owned dumbbell weights, kg; empty = no snapping
  avoid: readonly string[]; // exercise ids that must not appear
  candidates: Record<string, Candidate>; // dumbbell-compatible library exercises, by id
  supersets?: boolean; // the athlete asked for supersets; otherwise any superset letters are ignored
  routine?: Record<string, string>; // stretches and pulse raisers the AI may pick for warm-ups and cool-downs, id → name
}

export interface ValidExercise {
  exerciseId: string;
  reason: string;
  w: number; // kg, on the owned list when one exists
  reps: number; // inside the exercise's rep range
  sets: number;
}

export interface ValidPlan {
  name: string;
  note: string;
  days: { label: string; exercises: ValidExercise[]; supersets?: string[][]; warmup?: string[]; cooldown?: string[] }[];
}

export interface Correction {
  path: string; // e.g. days[0].exercises[1].w
  from: number;
  to: number;
  why: string;
}

export type ValidationResult =
  | { ok: true; plan: ValidPlan; corrections: Correction[] }
  | { ok: false; errors: string[] };

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isFiniteNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

// Plain text only (SPEC §5.4): no HTML tags, no Markdown links or code, no bare URLs.
export const MARKUP = /<[^>]*>|\]\(|https?:\/\/|`/;

export function validateAiPlan(raw: unknown, input: PlanInput): ValidationResult {
  let data: unknown = raw;
  if (typeof raw === 'string') {
    try {
      data = JSON.parse(raw); // §5.5 step 1
    } catch {
      return { ok: false, errors: ['not JSON'] };
    }
  }
  const errors: string[] = [];
  const corrections: Correction[] = [];

  // Step 2: schema, types and lengths.
  if (!isObj(data) || !isObj(data.plan) || typeof data.note !== 'string') {
    return { ok: false, errors: ['missing plan or note'] };
  }
  const plan = data.plan;
  if (typeof plan.name !== 'string' || plan.name.length === 0 || plan.name.length > AI_PLAN_LIMITS.nameMax) {
    errors.push(`plan.name must be text of 1 to ${AI_PLAN_LIMITS.nameMax} characters`);
  }
  if (data.note.length > AI_PLAN_LIMITS.noteMax) errors.push(`note is over ${AI_PLAN_LIMITS.noteMax} characters`);
  if (!Array.isArray(plan.days)) errors.push('plan.days must be a list');
  if (MARKUP.test(String(plan.name)) || MARKUP.test(data.note)) errors.push('plain text only: no markup or links');

  const days = Array.isArray(plan.days) ? plan.days : [];
  const outDays: ValidPlan['days'] = [];

  // Step 5 first (day count) so a wrong count is reported even when a day has other problems.
  if (days.length !== input.daysPerWeek) {
    errors.push(`plan has ${days.length} days, the setting is ${input.daysPerWeek}`);
  }

  days.forEach((day, di) => {
    const at = `days[${di}]`;
    if (!isObj(day) || typeof day.label !== 'string' || !Array.isArray(day.exercises)) {
      errors.push(`${at} needs label and exercises`);
      return;
    }
    if (MARKUP.test(day.label)) errors.push(`${at}.label: plain text only`);
    if (day.exercises.length === 0) errors.push(`${at} has no exercises`);
    if (day.exercises.length > input.exercisesPerDay) {
      errors.push(`${at} has ${day.exercises.length} exercises, the session fits ${input.exercisesPerDay}`);
    }
    const exOut: ValidExercise[] = [];
    const letters: (string | null)[] = []; // superset letter per kept exercise
    day.exercises.forEach((ex, ei) => {
      const p = `${at}.exercises[${ei}]`;
      if (!isObj(ex) || typeof ex.exerciseId !== 'string' || typeof ex.reason !== 'string') {
        errors.push(`${p} needs exerciseId and reason`);
        return;
      }
      if (!isFiniteNum(ex.w) || ex.w < 0 || !isFiniteNum(ex.reps) || !isFiniteNum(ex.sets)) {
        errors.push(`${p} needs numeric w, reps and sets`);
        return;
      }
      if (ex.reason.length > AI_PLAN_LIMITS.reasonMax) errors.push(`${p}.reason is over ${AI_PLAN_LIMITS.reasonMax} characters`);
      if (MARKUP.test(ex.reason)) errors.push(`${p}.reason: plain text only`);
      if (!Number.isInteger(ex.sets) || ex.sets < AI_PLAN_LIMITS.setsMin || ex.sets > AI_PLAN_LIMITS.setsMax) {
        errors.push(`${p}.sets must be ${AI_PLAN_LIMITS.setsMin} to ${AI_PLAN_LIMITS.setsMax}`);
        return;
      }

      // Step 3 and 4: the exercise exists, is dumbbell-compatible, and is not avoided.
      const cand = input.candidates[ex.exerciseId];
      if (!cand) {
        errors.push(`${p}: unknown exerciseId ${ex.exerciseId}`);
        return;
      }
      if (input.avoid.includes(ex.exerciseId)) {
        errors.push(`${p}: ${cand.name} is on the avoid list`);
        return;
      }

      // Corrections (not errors): snap the weight to an owned bell, clamp reps to the range.
      const loads = cand.loads === undefined ? input.owned : cand.loads;
      if (loads !== null && ex.w <= 0) {
        errors.push(`${p} needs numeric w, reps and sets`);
        return;
      }
      let w = ex.w;
      if (loads === null) {
        if (ex.w !== 0) {
          corrections.push({ path: `${p}.w`, from: ex.w, to: 0, why: 'this exercise carries no weight' });
          w = 0;
        }
      } else if (loads.length > 0) {
        const snapped = ownedFloor(loads, ex.w);
        if (snapped !== ex.w) {
          corrections.push({ path: `${p}.w`, from: ex.w, to: snapped, why: 'snapped to an owned weight' });
          w = snapped;
        }
      }
      // Rounding a fraction is not a correction; only moving a rounded value into the range is reported.
      const rounded = Math.round(ex.reps);
      const reps = Math.min(cand.repMax, Math.max(cand.repMin, rounded));
      if (reps !== rounded) {
        corrections.push({ path: `${p}.reps`, from: rounded, to: reps, why: `kept inside ${cand.repMin} to ${cand.repMax}` });
      }
      exOut.push({ exerciseId: ex.exerciseId, reason: ex.reason, w, reps, sets: ex.sets });
      letters.push(input.supersets && typeof ex.superset === 'string' && /^[A-Z]$/.test(ex.superset) ? ex.superset : null);
    });
    // Same exercise twice within one day is a violation.
    const dup = exOut.find((e, i) => exOut.findIndex((o) => o.exerciseId === e.exerciseId) !== i);
    if (dup) errors.push(`${at}: ${dup.exerciseId} appears twice in one day`);
    const supersets = supersetRuns(exOut.map((e) => e.exerciseId), letters);
    // Warm-up and cool-down picks: only ids from the routine list, no repeats, at most ROUTINE.aiMaxItems. Anything
    // else is dropped and the rules fill the gap (never an error).
    const routinePick = (v: unknown): string[] => {
      if (!Array.isArray(v) || !input.routine) return [];
      return [...new Set(v.filter((id): id is string => typeof id === 'string' && Object.hasOwn(input.routine!, id)))].slice(0, ROUTINE.aiMaxItems);
    };
    const warmup = routinePick(day.warmup);
    const cooldown = routinePick(day.cooldown);
    outDays.push({
      label: day.label,
      exercises: exOut,
      ...(supersets.length > 0 ? { supersets } : {}),
      ...(warmup.length > 0 ? { warmup } : {}),
      ...(cooldown.length > 0 ? { cooldown } : {}),
    });
  });

  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, plan: { name: plan.name as string, note: data.note, days: outDays }, corrections };
}

// Supersets from the AI's letters: each run of adjacent exercises with the same letter, SUPERSET.minSize to maxSize long, the first run of a
// letter only. Anything else is dropped (a plan without supersets is still a good plan), never an error.
export function supersetRuns(ids: readonly string[], letters: readonly (string | null)[]): string[][] {
  const out: string[][] = [];
  const seen = new Set<string>();
  for (let i = 0; i < ids.length; ) {
    const l = letters[i];
    let j = i + 1;
    while (l !== null && j < ids.length && letters[j] === l) j++;
    if (l !== null && !seen.has(l) && j - i >= SUPERSET.minSize && j - i <= SUPERSET.maxSize) out.push(ids.slice(i, j));
    if (l !== null) seen.add(l);
    i = j;
  }
  return out;
}
