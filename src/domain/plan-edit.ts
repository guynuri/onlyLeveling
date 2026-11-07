// Pure edits to a saved plan (U4): add, remove, reorder, retarget, swap, block and schedule. Each returns a new plan
// with `updatedAt = now`, or the very same plan object when the request is not allowed, so a caller can tell.
import { BLOCK } from '../config/thresholds';
import { AI_PLAN_LIMITS } from '../../shared/ai-plan';
import { blockOf } from './block';
import { parseCardio, type CardioType } from './cardio';
import type { Plan } from './plan';
import type { Target, TemplateDay } from './template';

const validTarget = (t: Target) =>
  Number.isInteger(t.sets) &&
  t.sets >= AI_PLAN_LIMITS.setsMin &&
  t.sets <= AI_PLAN_LIMITS.setsMax &&
  Number.isInteger(t.repMin) &&
  Number.isInteger(t.repMax) &&
  t.repMin >= 1 &&
  t.repMax <= AI_PLAN_LIMITS.repsMax &&
  t.repMin <= t.repMax;

// Replaces one day and drops the weight adjustment of any exercise that no day uses any more.
function withDay(plan: Plan, dayIndex: number, day: TemplateDay, now: number): Plan {
  const days = plan.days.map((d, i) => (i === dayIndex ? day : d));
  const used = new Set(days.flatMap((d) => d.exerciseIds));
  return { ...plan, days, adjustments: plan.adjustments.filter((a) => used.has(a.exerciseId)), updatedAt: now };
}

export function addExercise(plan: Plan, dayIndex: number, exerciseId: string, target: Target, now: number): Plan {
  const day = plan.days[dayIndex];
  if (!day || day.kind === 'cardio' || day.exerciseIds.includes(exerciseId) || !validTarget(target)) return plan;
  return withDay(plan, dayIndex, { ...day, exerciseIds: [...day.exerciseIds, exerciseId], targets: { ...day.targets, [exerciseId]: target } }, now);
}

export function removeExercise(plan: Plan, dayIndex: number, exerciseId: string, now: number): Plan {
  const day = plan.days[dayIndex];
  if (!day || !day.exerciseIds.includes(exerciseId) || day.exerciseIds.length <= 1) return plan;
  const targets = { ...day.targets };
  delete targets[exerciseId];
  return withDay(plan, dayIndex, { ...day, exerciseIds: day.exerciseIds.filter((id) => id !== exerciseId), targets }, now);
}

export function moveExercise(plan: Plan, dayIndex: number, exerciseId: string, delta: -1 | 1, now: number): Plan {
  const day = plan.days[dayIndex];
  const from = day ? day.exerciseIds.indexOf(exerciseId) : -1;
  const to = from + delta;
  if (!day || from === -1 || to < 0 || to >= day.exerciseIds.length) return plan;
  const ids = [...day.exerciseIds];
  [ids[from], ids[to]] = [ids[to], ids[from]];
  return withDay(plan, dayIndex, { ...day, exerciseIds: ids }, now);
}

export function setTarget(plan: Plan, dayIndex: number, exerciseId: string, target: Target, now: number): Plan {
  const day = plan.days[dayIndex];
  if (!day || !day.exerciseIds.includes(exerciseId) || !validTarget(target)) return plan;
  return withDay(plan, dayIndex, { ...day, targets: { ...day.targets, [exerciseId]: target } }, now);
}

// One day only (the coach's swap replaces it everywhere). The new exercise keeps the old one's place and target.
export function replaceInDay(plan: Plan, dayIndex: number, fromId: string, toId: string, now: number): Plan {
  const day = plan.days[dayIndex];
  if (!day || !day.exerciseIds.includes(fromId) || day.exerciseIds.includes(toId)) return plan;
  const targets = { ...day.targets };
  if (targets[fromId]) targets[toId] = targets[fromId];
  delete targets[fromId];
  return withDay(plan, dayIndex, { ...day, exerciseIds: day.exerciseIds.map((id) => (id === fromId ? toId : id)), targets }, now);
}

export function extendBlock(plan: Plan, weeks: number, now: number): Plan {
  const b = blockOf(plan);
  return { ...plan, block: { ...b, weeks: Math.min(BLOCK.maxWeeks, b.weeks + weeks) }, updatedAt: now };
}

// A new block over the same days: the clock restarts now.
export function startBlock(plan: Plan, weeks: number, now: number): Plan {
  return { ...plan, block: { weeks, startedAt: now, deloadLastWeek: blockOf(plan).deloadLastWeek }, updatedAt: now };
}

export function setDeload(plan: Plan, on: boolean, now: number): Plan {
  return { ...plan, block: { ...blockOf(plan), deloadLastWeek: on }, updatedAt: now };
}

// Weekdays (0 = Sunday … 6): one per day, strictly ascending. Rotation clears them.
export function setSchedule(plan: Plan, schedule: 'rotation' | 'weekdays', weekdays: number[] | undefined, now: number): Plan {
  if (schedule === 'rotation') {
    const { weekdays: _drop, ...rest } = plan;
    return { ...rest, schedule, updatedAt: now };
  }
  const ok =
    weekdays !== undefined &&
    weekdays.length === plan.days.length &&
    weekdays.every((d, i) => Number.isInteger(d) && d >= 0 && d <= 6 && (i === 0 || d > weekdays[i - 1]));
  return ok ? { ...plan, schedule, weekdays, updatedAt: now } : plan;
}

// The day list changed, so the weekday list (one weekday per day) no longer fits: rotate until it is picked again.
function afterDaysChanged(plan: Plan, days: TemplateDay[], now: number): Plan {
  const used = new Set(days.flatMap((d) => d.exerciseIds));
  const { weekdays: _drop, ...rest } = plan;
  return {
    ...(plan.schedule === 'weekdays' ? rest : plan),
    schedule: plan.schedule === 'weekdays' ? 'rotation' : plan.schedule,
    days,
    daysPerWeek: days.filter((d) => d.kind !== 'cardio').length, // lifting days: the coach's missed-session rule reads this
    adjustments: plan.adjustments.filter((a) => used.has(a.exerciseId)),
    updatedAt: now,
  };
}

const cardioOk = (c: { type: CardioType; minutes: number }) => parseCardio({ type: c.type, minutes: c.minutes, distanceKm: null, effort: null }).ok;

// A standalone cardio day (U5b): no exercises, logged with the cardio form, and it fills a slot in the weekly streak.
export function addCardioDay(plan: Plan, cardio: { type: CardioType; minutes: number }, now: number): Plan {
  if (!cardioOk(cardio)) return plan;
  const existing = plan.days.filter((d) => d.kind === 'cardio').length;
  const day: TemplateDay = {
    index: plan.days.length,
    label: existing === 0 ? 'Cardio' : `Cardio ${existing + 1}`,
    kind: 'cardio',
    cardio,
    warmup: [],
    exerciseIds: [],
    cooldown: [],
  };
  return afterDaysChanged(plan, [...plan.days, day], now);
}

export function removeDay(plan: Plan, dayIndex: number, now: number): Plan {
  if (!plan.days[dayIndex] || plan.days.length <= 1) return plan;
  const days = plan.days.filter((_, i) => i !== dayIndex).map((d, i) => ({ ...d, index: i }));
  return afterDaysChanged(plan, days, now);
}

export function setCardioDay(plan: Plan, dayIndex: number, cardio: { type: CardioType; minutes: number }, now: number): Plan {
  const day = plan.days[dayIndex];
  if (!day || day.kind !== 'cardio' || !cardioOk(cardio)) return plan;
  return { ...plan, days: plan.days.map((d, i) => (i === dayIndex ? { ...d, cardio } : d)), updatedAt: now };
}

