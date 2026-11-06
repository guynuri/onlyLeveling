// The saved plan (SPEC §3, PLAN Phase 3 gap). Built once from the rules, then static until the user changes it:
// rebuilt only when days per week changes, or edited by an accepted coach suggestion.
import type { TemplateDay } from './template';
import type { Workout } from './types';
import type { Suggestion } from './suggestion';
import { ownedDown, ownedFloor } from './dumbbells';

export interface Adjustment {
  exerciseId: string;
  w: number; // the weight the next session uses instead of the progression's
  at: number; // set when accepted; cleared once a session with this exercise is logged after it
}

// A training block (UX design §5): its length, when it started, and whether its last week is a planned deload.
export interface Block {
  weeks: 4 | 6 | 8 | 12;
  startedAt: number; // epoch ms
  deloadLastWeek: boolean;
}

export interface Plan {
  daysPerWeek: number;
  days: TemplateDay[];
  adjustments: Adjustment[];
  // U4. All optional: a plan saved before U4 is read through domain/block.ts.
  block?: Block;
  schedule?: 'rotation' | 'weekdays';
  weekdays?: number[]; // 0 = Sunday … 6; one per day, ascending (schedule 'weekdays')
  updatedAt: number; // the missed-session count restarts from here
}

export function planFromTemplate(days: TemplateDay[], daysPerWeek: number, now: number): Plan {
  return { daysPerWeek, days, adjustments: [], updatedAt: now };
}

export function planExerciseIds(plan: Plan): string[] {
  return [...new Set(plan.days.flatMap((d) => d.exerciseIds))];
}

// The weight an accepted adjustment sets for the next session, or null when none is waiting. It is used until a
// session with that exercise is logged after the adjustment was made.
export function activeAdjustment(plan: Plan, exerciseId: string, workouts: readonly Workout[]): number | null {
  const adj = plan.adjustments.find((a) => a.exerciseId === exerciseId);
  if (!adj) return null;
  const logged = workouts.some((w) => w.start >= adj.at && w.entries.some((e) => e.exerciseId === exerciseId));
  return logged ? null : adj.w;
}

// Replaces one exercise in every day it appears in. Its weight adjustment goes with it. Pure.
export function replaceExercise(plan: Plan, fromId: string, toId: string, now: number): Plan {
  return {
    ...plan,
    days: plan.days.map((d) => ({ ...d, exerciseIds: d.exerciseIds.map((id) => (id === fromId ? toId : id)) })),
    adjustments: plan.adjustments.filter((a) => a.exerciseId !== fromId),
    updatedAt: now,
  };
}

// Applies an accepted suggestion. Pure: returns the new plan. Caller saves it.
export function applySuggestion(plan: Plan, s: Suggestion, now: number, owned: readonly number[]): Plan {
  if (s.action.kind === 'swap') return replaceExercise(plan, s.exerciseId, s.action.toId, now);
  // Weight action: snap to an owned bell, so the weight is always one the user has.
  const w = owned.length > 0 ? ownedFloor(owned, s.action.w) : s.action.w;
  const adj: Adjustment = { exerciseId: s.exerciseId, w, at: now };
  return {
    ...plan,
    adjustments: [...plan.adjustments.filter((a) => a.exerciseId !== s.exerciseId), adj],
    updatedAt: now,
  };
}

// A deload target: the factor applied, snapped down to an owned bell, and always below the current weight.
export function deloadWeight(w: number, owned: readonly number[], factor: number): number {
  const target = w * factor;
  const snapped = owned.length > 0 ? ownedFloor(owned, target) : target;
  if (snapped < w) return snapped;
  return owned.length > 0 ? (ownedDown(owned, w) ?? w) : w;
}
