// Block and schedule maths for a plan (UX design §5, U4). Pure: the clock is always passed in.
import { BLOCK, COACH, TRAINING } from '../config/thresholds';
import type { Exercise } from './exercise';
import { deloadWeight, type Block, type Plan } from './plan';
import type { Prescription } from './progression';
import { repRangeFor } from './reps';
import type { Target, TemplateDay } from './template';

// An older plan has no block: it counts as an 8-week block from when it was last saved.
export function blockOf(plan: Plan): Block {
  return plan.block ?? { weeks: BLOCK.defaultWeeks, startedAt: plan.updatedAt, deloadLastWeek: true };
}

// Pins an older plan's block start. Without this, every later edit (which moves updatedAt) would move the default
// start too and restart the week count. Returns the same plan when it already has a block.
export function materializeBlock(plan: Plan): Plan {
  return plan.block ? plan : { ...plan, block: blockOf(plan) };
}

// Week 1 of N. Past the end it stays on the last week and says `over`, so the screen never shows "Week 11 of 8".
export function blockWeek(plan: Plan, now: number): { week: number; of: number; over: boolean } {
  const b = blockOf(plan);
  const week = Math.max(1, Math.floor((now - b.startedAt) / BLOCK.weekMs) + 1);
  return week > b.weeks ? { week: b.weeks, of: b.weeks, over: true } : { week, of: b.weeks, over: false };
}

export function isDeloadWeek(plan: Plan, now: number): boolean {
  const b = blockOf(plan);
  const w = blockWeek(plan, now);
  return b.deloadLastWeek && !w.over && w.week === w.of;
}

// The day to train next. Rotation: by finished sessions. Weekdays: today's day if scheduled, else the next scheduled
// weekday (wrapping past Sunday). A weekdays plan with no usable list rotates instead.
// `finishedSessions` should count sessions in this block (sessionsInBlock). `workoutStarts` lets a weekdays plan see that
// today's session is already logged and offer the next scheduled weekday instead.
export function nextSession(plan: Plan, finishedSessions: number, now: number, workoutStarts: readonly number[] = []): TemplateDay | null {
  const n = plan.days.length;
  if (n === 0) return null;
  const wd = plan.weekdays;
  if (plan.schedule === 'weekdays' && wd && wd.length === n) {
    const date = new Date(now);
    const doneToday = workoutStarts.some((s) => new Date(s).toDateString() === date.toDateString());
    const today = date.getDay();
    const i = wd.findIndex((d) => (doneToday ? d > today : d >= today));
    return plan.days[i === -1 ? 0 : i];
  }
  return plan.days[finishedSessions % n];
}

// Workouts logged since the plan's block started: a rotation starts at the first day of a new plan or block, not
// part-way through because of older workouts.
export function sessionsInBlock(plan: Plan, workouts: readonly { start: number }[]): number {
  const from = blockOf(plan).startedAt;
  return workouts.filter((w) => w.start >= from).length;
}

export function targetOf(day: TemplateDay, ex: Pick<Exercise, 'id' | 'mechanic'>): Target {
  const r = repRangeFor(ex);
  return day.targets?.[ex.id] ?? { sets: TRAINING.defaultSets, repMin: r.min, repMax: r.max };
}

// A planned deload week: lighter bells (the coach's deload factor) for weighted work, one set fewer for reps-only work.
export function deloaded(p: Prescription, weighted: boolean, owned: readonly number[]): Prescription {
  if (!weighted) return { ...p, sets: Math.max(1, p.sets - 1) };
  const factor = Math.min(COACH.deloadMaxFactor, Math.max(COACH.deloadMinFactor, COACH.deloadFactor));
  return { ...p, w: deloadWeight(p.w, owned, factor) };
}
