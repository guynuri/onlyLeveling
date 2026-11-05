// Coach rules (SPEC §4). Pure: each takes history and the clock, and returns what it saw. Thresholds from config.
import { COACH } from '../../../config/thresholds';
import { e1rm } from '../../../domain/onerm';
import type { HistorySession } from '../../../domain/progression';
import type { Workout } from '../../../domain/types';

const DAY = 86_400_000;
const WEEK = 7 * DAY;

// One exercise's sessions, oldest first (shaped for the rules).
export function historyOf(workouts: readonly Workout[], exerciseId: string): HistorySession[] {
  return workouts
    .flatMap((w) => w.entries.filter((e) => e.exerciseId === exerciseId).map((e) => ({ date: w.start, target: e.planned, sets: e.sets })))
    .sort((a, b) => a.date - b.date);
}

// Best estimated max of one session's working sets (Epley, reps ≤ 12). Null when no set qualifies.
export function sessionBestE1rm(s: HistorySession): number | null {
  let best: number | null = null;
  for (const set of s.sets) {
    if (!set.done || set.phase !== 'work') continue;
    const v = e1rm(set.w, set.r);
    if (v !== null && (best === null || v > best)) best = v;
  }
  return best;
}

export interface StallFinding {
  bestRecent: number; // best estimated max inside the window
  bestBefore: number; // best estimated max before the window
  sessionsRecent: number;
}

// Stalled (SPEC §4): no session in the last stallWeeks beat the best from before that window. Needs
// stallMinSessions sessions inside the window and at least one scored session before it.
export function detectStall(history: readonly HistorySession[], now: number): StallFinding | null {
  const start = now - COACH.stallWeeks * WEEK;
  const recent = history.filter((s) => s.date > start);
  const before = history.filter((s) => s.date <= start);
  if (recent.length < COACH.stallMinSessions) return null;
  const bestBefore = maxOf(before.map(sessionBestE1rm));
  const recentScores = recent.map(sessionBestE1rm).filter((v): v is number => v !== null);
  if (bestBefore === null || recentScores.length < COACH.stallMinSessions) return null;
  const bestRecent = Math.max(...recentScores);
  if (bestRecent > bestBefore) return null;
  return { bestRecent, bestBefore, sessionsRecent: recent.length };
}

// Too easy (SPEC §4): the last tooEasySessions sessions were each at the top of the range with RIR ≥ tooEasyRir
// on every decisive set. A session with RIR not logged does not count, so the rule stays off without RIR.
export function detectTooEasy(history: readonly HistorySession[], repMax: number): boolean {
  const last = history.slice(-COACH.tooEasySessions);
  if (last.length < COACH.tooEasySessions) return false;
  return last.every((s) => {
    if (s.target.reps < repMax) return false;
    const decisive = s.sets.filter((set) => set.phase === 'work').slice(0, s.target.sets);
    return decisive.length > 0 && decisive.every((set) => set.rir !== undefined && set.rir >= COACH.tooEasyRir);
  });
}

// Stale (SPEC §4): the same exercise for staleWeeks or more, counted from its first logged session.
export function detectStale(history: readonly HistorySession[], now: number): boolean {
  if (history.length === 0) return false;
  return now - history[0].date >= COACH.staleWeeks * WEEK;
}

// Missed sessions (SPEC §4.1): expected sessions (daysPerWeek a week) since this exercise was last logged, or since
// the plan last changed if that is later. Ceiling: no per-day schedule, so this is an estimate from the week count.
export function missedSessions(history: readonly HistorySession[], planUpdatedAt: number, daysPerWeek: number, now: number): number {
  const last = history.length ? history[history.length - 1].date : 0;
  const from = Math.max(last, planUpdatedAt);
  if (now <= from) return 0;
  return Math.floor(((now - from) / WEEK) * daysPerWeek);
}

function maxOf(values: (number | null)[]): number | null {
  const nums = values.filter((v): v is number => v !== null);
  return nums.length ? Math.max(...nums) : null;
}
