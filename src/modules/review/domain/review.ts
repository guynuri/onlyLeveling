// The facts behind the weekly review (PLAN, SPEC Phase 2). Pure: the caller passes the clock and the data. The week is
// Monday to Sunday in the device's local time, the same as the streak.
import type { Workout } from '../../../domain/types';
import type { WeekFacts } from '../../../../shared/ai-review';

function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// The Monday that starts the last closed week, as YYYY-MM-DD. This week is never closed, so it is never reviewed.
export function lastClosedWeekStart(now: Date): string {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const sinceMonday = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - sinceMonday - 7);
  return ymd(d);
}

// Local midnight of the Monday that starts `week`, and the midnight after its Sunday.
function weekBounds(week: string): { from: number; to: number } {
  const [y, m, d] = week.split('-').map(Number);
  const from = new Date(y, m - 1, d).getTime();
  const to = new Date(y, m - 1, d + 7).getTime();
  return { from, to };
}

export function sessionsIn(week: string, workouts: readonly Workout[]): number {
  const { from, to } = weekBounds(week);
  return workouts.filter((w) => w.start >= from && w.start < to).length;
}

// The card shows once per week: it is shown unless it was already shown for this week (the last week shown is kept).
export function showReviewCard(lastShownWeek: string | null, week: string): boolean {
  return lastShownWeek !== week;
}

// A rules text is stored only when the AI itself did not answer. A spent daily quota is not an AI failure: the week
// stays open, so a later open can still ask the AI.
export function shouldStoreRules(reason: string): boolean {
  return reason !== 'capped';
}

export function buildFacts(input: {
  week: string;
  workouts: readonly Workout[];
  daysPerWeek: number;
  streakWeeks: number;
  pendingSuggestions: number;
}): WeekFacts {
  return {
    week: input.week,
    sessionsDone: sessionsIn(input.week, input.workouts),
    sessionsPlanned: input.daysPerWeek,
    streakWeeks: input.streakWeeks,
    openSwaps: input.pendingSuggestions,
  };
}
