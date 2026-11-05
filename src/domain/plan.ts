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

export interface Plan {
  daysPerWeek: number;
  days: TemplateDay[];
  adjustments: Adjustment[];
  updatedAt: number; // the missed-session count restarts from here
}

export function planFromTemplate(days: TemplateDay[], daysPerWeek: number, now: number): Plan {
  return { daysPerWeek, days, adjustments: [], updatedAt: now };
}

export function planIsCurrent(plan: Plan, daysPerWeek: number): boolean {
  return plan.daysPerWeek === daysPerWeek;
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

// Applies an accepted suggestion. Pure: returns the new plan. Caller saves it.
export function applySuggestion(plan: Plan, s: Suggestion, now: number, owned: readonly number[]): Plan {
  if (s.action.kind === 'swap') {
    const toId = s.action.toId;
    const fromId = s.exerciseId;
    return {
      ...plan,
      days: plan.days.map((d) => ({ ...d, exerciseIds: d.exerciseIds.map((id) => (id === fromId ? toId : id)) })),
      adjustments: plan.adjustments.filter((a) => a.exerciseId !== fromId),
      updatedAt: now,
    };
  }
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
