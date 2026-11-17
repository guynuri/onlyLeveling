// Validation of an AI-proposed first plan (SPEC §5.4, §5.5). Pure, shared by the Worker (retry decision) and the app
// (copy-paste fallback). The AI is never trusted for numbers: every value is checked here, and out-of-range numbers are
// corrected and reported, never silently passed on.
import { ownedFloor } from '../src/domain/dumbbells';
import { FOCUS, ROUTINE, SESSION_TIME, SUPERSET, TRAINING } from '../src/config/thresholds';
import { daySeconds, minutesOf, trimToBudget, type TimedItem } from './session-time';

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
  // Optional (older apps omit them). groups: the muscle groups it mainly trains, for focus checks and the prompt.
  // timed: a hold, reps are seconds. unilateral: one side at a time. Both feed the time estimate.
  groups?: readonly string[];
  timed?: boolean;
  unilateral?: boolean;
}

export interface PlanInput {
  daysPerWeek: number;
  exercisesPerDay: number;
  owned: readonly number[]; // owned dumbbell weights, kg; empty = no snapping
  avoid: readonly string[]; // exercise ids that must not appear
  candidates: Record<string, Candidate>; // dumbbell-compatible library exercises, by id
  supersets?: boolean; // the athlete asked for supersets; otherwise any superset letters are ignored
  supersetSize?: 2 | 3; // the largest superset asked for; default SUPERSET.maxSize
  routine?: Record<string, string>; // stretches and pulse raisers the AI may pick for warm-ups and cool-downs, id → name
  // Owner decision 2026-11-17, all optional (older apps omit them):
  dayBudgetSec?: readonly number[]; // lifting seconds per day; a day running over by SESSION_TIME.overTolerance is trimmed
  restSec?: number; // rest between sets, for the time estimate
  focus?: readonly string[]; // focus muscle groups: each must get more weekly sets than the other groups' average
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
  const dayLetters: (string | null)[][] = [];

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
    dayLetters.push(letters);
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
    const supersets = supersetRuns(exOut.map((e) => e.exerciseId), letters, input.supersetSize);
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
  // Corrections that need the whole plan: focus muscles first (they may add work), then the time budget.
  topUpFocus(outDays, dayLetters, input, corrections);
  fitToBudget(outDays, dayLetters, input, corrections);
  return { ok: true, plan: { name: plan.name as string, note: data.note, days: outDays }, corrections };
}

type Days = ValidPlan['days'];

// Reps at the top of the candidate's range: the saved plan keeps the library range (planFromProposal), and the plan
// screen estimates from its top, so the check counts the same.
const timedItem = (e: ValidExercise, c: Candidate | undefined): TimedItem => ({
  id: e.exerciseId,
  sets: e.sets,
  reps: c?.repMax ?? e.reps,
  ...(c?.timed ? { timed: true } : {}),
  ...(c?.unilateral ? { unilateral: true } : {}),
});

const daySecs = (d: Days[number], input: PlanInput) =>
  daySeconds(
    d.exercises.map((e) => timedItem(e, input.candidates[e.exerciseId])),
    d.supersets ?? [],
    input.restSec ?? TRAINING.restSec,
  );

// Weekly working sets per muscle group (each exercise counts for its main groups).
function groupSets(days: Days, input: PlanInput): Map<string, number> {
  const out = new Map<string, number>();
  for (const d of days) {
    for (const e of d.exercises) {
      for (const g of new Set(input.candidates[e.exerciseId]?.groups ?? [])) out.set(g, (out.get(g) ?? 0) + e.sets);
    }
  }
  return out;
}

// Focus muscles (owner decision 2026-11-17): each needs FOCUS.aheadSets more weekly sets than the average of the other
// groups the plan trains. Short ones get one more set at a time on their lightest exercise (up to setsMax) on a day that
// still fits its time; one with no exercise at all gets a candidate added on the day with the most time left (the time
// check may then drop a non-focus exercise). Every change is a correction.
function topUpFocus(days: Days, letters: (string | null)[][], input: PlanInput, corrections: Correction[]): void {
  const focus = [...new Set(input.focus ?? [])];
  if (focus.length === 0 || days.length === 0) return;
  const trains = (id: string, g: string) => input.candidates[id]?.groups?.includes(g) ?? false;
  const target = () => {
    const others = [...groupSets(days, input).entries()].filter(([g, n]) => n > 0 && !focus.includes(g)).map(([, n]) => n);
    return others.length === 0 ? 1 : Math.floor(others.reduce((a, b) => a + b, 0) / others.length) + FOCUS.aheadSets;
  };
  const addExercise = (g: string): boolean => {
    const free = (d: Days[number], i: number) => (input.dayBudgetSec?.[i] ?? 0) - daySecs(d, input) - d.exercises.length; // fewer exercises breaks ties
    const order = days
      .map((d, i) => ({ d, i }))
      .filter(({ d }) => d.exercises.length < input.exercisesPerDay)
      .sort((a, b) => free(b.d, b.i) - free(a.d, a.i) || a.i - b.i);
    const used = new Set(days.flatMap((d) => d.exercises.map((e) => e.exerciseId)));
    for (const { d, i } of order) {
      const ids = Object.keys(input.candidates).filter((id) => trains(id, g) && !input.avoid.includes(id) && !d.exercises.some((e) => e.exerciseId === id));
      const id = ids.find((x) => !used.has(x)) ?? ids[0];
      if (!id) continue;
      const c = input.candidates[id];
      const loads = c.loads === undefined ? input.owned : c.loads;
      const w = loads === null ? 0 : loads.length > 0 ? ownedFloor(loads, TRAINING.startWeightKg) : TRAINING.startWeightKg;
      const sets = Math.min(AI_PLAN_LIMITS.setsMax, TRAINING.defaultSets);
      d.exercises.push({ exerciseId: id, reason: `Added for your focus on ${g}.`, w, reps: c.repMin, sets });
      letters[i].push(null);
      corrections.push({ path: `days[${i}].exercises[${d.exercises.length - 1}].sets`, from: 0, to: sets, why: `added ${c.name} for your focus on ${g}` });
      return true;
    }
    return false;
  };
  // One more set still fits the day's budget (with the time check's tolerance), or there is no budget.
  const roomFor = (di: number, ei: number) => {
    const budget = input.dayBudgetSec?.[di];
    if (budget === undefined) return true;
    const d = days[di];
    const more = { ...d, exercises: d.exercises.map((e, k) => (k === ei ? { ...e, sets: e.sets + 1 } : e)) };
    return daySecs(more, input) <= budget * (1 + SESSION_TIME.overTolerance);
  };
  const maxSteps = days.length * input.exercisesPerDay * AI_PLAN_LIMITS.setsMax; // every set slot once: always ends
  for (const g of focus) {
    let added = false;
    for (let step = 0; step < maxSteps; step++) {
      const have = groupSets(days, input).get(g) ?? 0;
      if (have >= target()) break;
      let best: { d: number; e: number } | null = null;
      days.forEach((d, di) =>
        d.exercises.forEach((e, ei) => {
          if (trains(e.exerciseId, g) && e.sets < AI_PLAN_LIMITS.setsMax && roomFor(di, ei) && (!best || e.sets < days[best.d].exercises[best.e].sets)) best = { d: di, e: ei };
        }),
      );
      if (have > 0 && best) {
        const { d, e } = best as { d: number; e: number };
        const ex = days[d].exercises[e];
        corrections.push({ path: `days[${d}].exercises[${e}].sets`, from: ex.sets, to: ex.sets + 1, why: `more sets for your focus on ${g}` });
        ex.sets += 1;
      } else if (added || have > 0 || !addExercise(g)) {
        break;
      } else {
        added = true;
      }
    }
  }
}

// Time budget (owner decision 2026-11-17): a day estimated more than SESSION_TIME.overTolerance over its budget drops
// exercises from the end, the ones for focus muscles last, never below SESSION_TIME.minExercises. Supersets are rebuilt
// from what is left. Every drop is a correction.
function fitToBudget(days: Days, letters: (string | null)[][], input: PlanInput, corrections: Correction[]): void {
  if (!input.dayBudgetSec) return;
  const focus = input.focus ?? [];
  days.forEach((d, i) => {
    const budget = input.dayBudgetSec?.[i];
    if (budget === undefined) return;
    const items = d.exercises.map((e) => timedItem(e, input.candidates[e.exerciseId]));
    const isFocus = (t: TimedItem) => focus.some((g) => input.candidates[t.id]?.groups?.includes(g));
    const { kept, dropped } = trimToBudget(items, d.supersets ?? [], input.restSec ?? TRAINING.restSec, budget * (1 + SESSION_TIME.overTolerance), isFocus, SESSION_TIME.minExercises);
    if (dropped.length === 0) return;
    for (const t of dropped) {
      const at = d.exercises.findIndex((e) => e.exerciseId === t.id);
      corrections.push({
        path: `days[${i}].exercises[${at}].sets`,
        from: t.sets,
        to: 0,
        why: `dropped ${input.candidates[t.id]?.name ?? t.id}: the day ran past about ${minutesOf(budget)} min of lifting`,
      });
    }
    const keep = new Set(kept.map((t) => t.id));
    const nextLetters = letters[i].filter((_, k) => keep.has(d.exercises[k].exerciseId));
    d.exercises = d.exercises.filter((e) => keep.has(e.exerciseId));
    letters[i] = nextLetters;
    const runs = supersetRuns(d.exercises.map((e) => e.exerciseId), nextLetters, input.supersetSize);
    if (runs.length > 0) d.supersets = runs;
    else delete d.supersets;
  });
}

// Supersets from the AI's letters: each run of adjacent exercises with the same letter, SUPERSET.minSize to maxSize long, the first run of a
// letter only. Anything else is dropped (a plan without supersets is still a good plan), never an error.
export function supersetRuns(ids: readonly string[], letters: readonly (string | null)[], maxSize: number = SUPERSET.maxSize): string[][] {
  const out: string[][] = [];
  const seen = new Set<string>();
  for (let i = 0; i < ids.length; ) {
    const l = letters[i];
    let j = i + 1;
    while (l !== null && j < ids.length && letters[j] === l) j++;
    if (l !== null && !seen.has(l) && j - i >= SUPERSET.minSize && j - i <= Math.min(maxSize, SUPERSET.maxSize)) {
      out.push(ids.slice(i, j));
      seen.add(l); // only a kept run uses up its letter
    }
    i = j;
  }
  return out;
}
