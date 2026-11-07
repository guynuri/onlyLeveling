// Everything the Progress screen shows, computed from history in one pass (SPEC §4b). Editing a past session changes
// the history, so the next compute gives new XP and ranks. Nothing here is stored except badges (see badges.ts).
import { XP } from '../../../config/thresholds';
import type { Exercise } from '../../../domain/exercise';
import type { BodyweightEntry, Workout } from '../../../domain/types';
import { cardioXp, countsForStreak, type CardioSession } from '../../../domain/cardio';
import { e1rm } from '../../../domain/onerm';
import { BENCHMARK, GROUPS, bellsFor, type Group } from './muscles';
import { emptyGroupXp, sessionXp, type GroupXp, type SessionEntry } from './sessionXp';
import { muscleRank, strengthRank, type Rank, RANKS } from './rank';
import { streakWeeks } from './streak';
import { earnedBadges } from './badges';

const DAY = 86_400_000;

export interface ProgressInput {
  workouts: readonly Workout[];
  exerciseById: (id: string) => Exercise | undefined;
  bodyweight: readonly BodyweightEntry[];
  cardio?: readonly CardioSession[]; // cardio XP, and planned cardio days for the streak
  daysPerWeek: number; // the plan's sessions per week, cardio days included
  repMaxFor: (exerciseId: string) => number;
  now: number;
}

export interface MuscleProgress {
  xp: number;
  rank: Rank; // now
  maxRank: Rank; // highest ever reached (badges use this)
  strength: Rank | null; // null for groups without a benchmark lift
}

export interface ProgressState {
  muscles: Record<Group, MuscleProgress>;
  sessions: number; // lifting sessions
  cardioXp: number; // never added to a muscle
  cardioSessions: number;
  streak: number;
  badges: string[];
  flaggedSets: number;
  usedDefaultBodyweight: boolean; // some bodyweight set was scored with the default bodyweight
}

// Local calendar day as a number, so day differences ignore DST.
function localDay(ms: number): number {
  const d = new Date(ms);
  return Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / DAY;
}
function isoDay(s: string): number {
  const [y, m, d] = s.split('-').map(Number);
  return Date.UTC(y, m - 1, d) / DAY;
}

// The latest bodyweight on or before the moment `ms`, within the window. Null when there is none.
export function bodyweightAt(ms: number, entries: readonly BodyweightEntry[]): number | null {
  return bodyweightFor(localDay(ms), entries);
}

// The latest bodyweight on or before the session day, within the window. Null when there is none.
function bodyweightFor(day: number, entries: readonly BodyweightEntry[]): number | null {
  let best: BodyweightEntry | null = null;
  for (const e of entries) {
    const ed = isoDay(e.date);
    if (ed <= day && day - ed <= XP.bodyweightWindowDays && (best === null || ed > isoDay(best.date))) best = e;
  }
  return best ? best.kg : null;
}

// Best estimated max of a benchmark lift in one session (both bells counted as the lift uses them).
function benchmarkValue(entries: readonly SessionEntry[], exerciseId: string): number | null {
  const e = entries.find((x) => x.exercise.id === exerciseId);
  if (!e) return null;
  let best: number | null = null;
  const bells = bellsFor(e.exercise);
  for (const s of e.sets) {
    if (!s.done || s.phase !== 'work') continue;
    const v = e1rm(s.w, s.r);
    if (v !== null && (best === null || v * bells > best)) best = v * bells;
  }
  return best;
}

export function computeProgress(input: ProgressInput): ProgressState {
  const sorted = [...input.workouts].sort((a, b) => a.start - b.start);
  const xp: GroupXp = emptyGroupXp();
  const ratios = Object.fromEntries(GROUPS.map((g) => [g, [] as number[]])) as Record<Group, number[]>;
  const maxRank = Object.fromEntries(GROUPS.map((g) => [g, 'F' as Rank])) as Record<Group, Rank>;
  const bestWeight = new Map<string, number>(); // exercise → best working weight so far
  const seen: { start: number; entries: SessionEntry[] }[] = [];
  let flaggedSets = 0;
  let usedDefaultBodyweight = false;
  let firstPr = false;
  let rankUp = false;

  for (const w of sorted) {
    const entries: SessionEntry[] = [];
    for (const e of w.entries) {
      const exercise = input.exerciseById(e.exerciseId);
      if (exercise) entries.push({ exercise, planned: e.planned, sets: e.sets });
    }
    const day = localDay(w.start);
    const windowStart = w.start - XP.weightDropWindowWeeks * 7 * DAY;
    const recentBest = (id: string): number | null => {
      let best: number | null = null;
      for (const s of seen) {
        if (s.start < windowStart || s.start >= w.start) continue;
        for (const e of s.entries) {
          if (e.exercise.id !== id) continue;
          for (const set of e.sets) {
            if (set.done && set.phase === 'work' && (best === null || set.w > best)) best = set.w;
          }
        }
      }
      return best;
    };

    const res = sessionXp(entries, recentBest, input.repMaxFor, bodyweightFor(day, input.bodyweight));
    flaggedSets += res.flaggedSets;
    if (res.usedDefaultBodyweight) usedDefaultBodyweight = true;
    for (const g of GROUPS) xp[g] += res.byGroup[g];

    // First personal record: a working weight above the best before it (the very first lift of an exercise is not one).
    for (const e of entries) {
      const prev = bestWeight.get(e.exercise.id);
      for (const set of e.sets) {
        if (!set.done || set.phase !== 'work') continue;
        if (prev !== undefined && set.w > prev) firstPr = true;
      }
      const top = Math.max(0, ...e.sets.filter((s) => s.done && s.phase === 'work').map((s) => s.w));
      if (top > 0) bestWeight.set(e.exercise.id, Math.max(prev ?? 0, top));
    }

    // Strength: one ratio per session with bodyweight, for each group that has a benchmark lift.
    const bw = bodyweightFor(day, input.bodyweight);
    const hasBodyweight = input.bodyweight.some((b) => isoDay(b.date) <= day);
    for (const g of GROUPS) {
      const benchId = BENCHMARK[g];
      if (!benchId || bw === null) continue;
      const v = benchmarkValue(entries, benchId);
      if (v !== null) ratios[g].push(v / bw);
    }
    for (const g of GROUPS) {
      const strength = BENCHMARK[g] ? strengthRank(ratios[g]) : null;
      const r = muscleRank(xp[g], strength, hasBodyweight);
      if (RANKS.indexOf(r) > RANKS.indexOf(maxRank[g])) maxRank[g] = r;
      if (RANKS.indexOf(r) > 0) rankUp = true;
    }
    seen.push({ start: w.start, entries });
  }

  const hasBodyweightNow = input.bodyweight.length > 0;
  const muscles = Object.fromEntries(
    GROUPS.map((g) => {
      const strength = BENCHMARK[g] ? strengthRank(ratios[g]) : null;
      const now = muscleRank(xp[g], strength, hasBodyweightNow);
      return [g, { xp: xp[g], rank: now, maxRank: maxRank[g], strength }];
    }),
  ) as Record<Group, MuscleProgress>;

  const sessions = sorted.length;
  const cardio = input.cardio ?? [];
  // A lifting session fills a slot, and so does a finished planned cardio day; an extra or post-lift one does not.
  const slotStarts = [...sorted.map((w) => w.start), ...cardio.filter(countsForStreak).map((c) => c.start)];
  return {
    muscles,
    sessions,
    cardioXp: cardio.reduce((sum, c) => sum + cardioXp(c), 0),
    cardioSessions: cardio.length,
    streak: streakWeeks(slotStarts, input.daysPerWeek, input.now),
    badges: earnedBadges({ sessions, firstPr, rankUp, maxRank }),
    flaggedSets,
    usedDefaultBodyweight,
  };
}
