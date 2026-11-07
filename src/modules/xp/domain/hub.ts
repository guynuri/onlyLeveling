// Numbers for the Home hub and Progress v2 (UX design §6.2, §6.6, U6): player level, XP to the next rank, the
// body-map slugs per XP group, recovery/neglect per group, and the bodyweight trend. Pure: the clock is passed in.
import { RECOVERY, WEIGHT_TREND_DAYS, XP } from '../../../config/thresholds';
import type { BodySlug } from '../../../domain/muscle-map';
import type { Exercise } from '../../../domain/exercise';
import type { BodyweightEntry, Workout } from '../../../domain/types';
import { GROUPS, groupOf, type Group } from './muscles';
import { RANKS, volumeRank, type Rank } from './rank';
import type { MuscleProgress } from './progress';

const DAY = 86_400_000;

// The 18 drawn muscles onto the 10 XP groups. Every slug belongs to exactly one group (tested).
export const GROUP_SLUGS: Record<Group, readonly BodySlug[]> = {
  chest: ['chest'],
  back: ['upper-back', 'trapezius', 'lower-back'],
  shoulders: ['deltoids'],
  biceps: ['biceps', 'forearm'],
  triceps: ['triceps'],
  quads: ['quadriceps', 'adductors', 'hip-flexors'],
  hamstrings: ['hamstring'],
  glutes: ['gluteal'],
  calves: ['calves', 'tibialis'],
  core: ['abs', 'obliques', 'serratus'],
};

export function groupOfSlug(slug: BodySlug): Group {
  return GROUPS.find((g) => GROUP_SLUGS[g].includes(slug)) ?? 'core';
}

// XP still needed for the next volume rank, or null at the top. (Strength can hold a rank back; this is volume only.)
export function xpToNextRank(xp: number): { next: Rank; need: number } | null {
  const next = RANKS.find((r) => XP.rankXp[r] > xp);
  return next ? { next, need: XP.rankXp[next] - xp } : null;
}

// Share of the way from the current volume rank's XP to the next one, 0 to 1 (1 at the top rank).
export function rankProgress(xp: number): number {
  const next = RANKS.find((r) => XP.rankXp[r] > xp);
  if (!next) return 1;
  const from = XP.rankXp[RANKS[RANKS.indexOf(next) - 1]];
  return (xp - from) / (XP.rankXp[next] - from);
}

export type Recovery = 'recovering' | 'ready' | 'neglected';

// Per group: when its primary muscles last did a finished working set.
export function recoveryOf(
  workouts: readonly Workout[],
  exerciseById: (id: string) => Pick<Exercise, 'primaryMuscles'> | undefined,
  now: number,
): Record<Group, Recovery> {
  const last = new Map<Group, number>();
  for (const w of workouts) {
    for (const e of w.entries) {
      if (!e.sets.some((s) => s.done && s.phase === 'work')) continue;
      for (const m of exerciseById(e.exerciseId)?.primaryMuscles ?? []) {
        const g = groupOf(m);
        if (g && w.start > (last.get(g) ?? -Infinity)) last.set(g, w.start);
      }
    }
  }
  return Object.fromEntries(
    GROUPS.map((g) => {
      const t = last.get(g);
      if (t === undefined || now - t >= RECOVERY.neglectedDays * DAY) return [g, 'neglected'];
      return [g, now - t < RECOVERY.recoveringHours * 3_600_000 ? 'recovering' : 'ready'];
    }),
  ) as Record<Group, Recovery>;
}

// Exercises from history that train the group (primary), most sessions first.
export function exercisesFor(
  group: Group,
  workouts: readonly Workout[],
  exerciseById: (id: string) => Pick<Exercise, 'primaryMuscles'> | undefined,
  limit = 5,
): string[] {
  const count = new Map<string, number>();
  for (const w of workouts) {
    for (const e of w.entries) {
      if (exerciseById(e.exerciseId)?.primaryMuscles.some((m) => groupOf(m) === group)) {
        count.set(e.exerciseId, (count.get(e.exerciseId) ?? 0) + 1);
      }
    }
  }
  return [...count].sort((a, b) => b[1] - a[1]).slice(0, limit).map(([id]) => id);
}

const isoDay = (s: string) => {
  const [y, m, d] = s.split('-').map(Number);
  return Date.UTC(y, m - 1, d) / DAY;
};

// Entries by date, each with the average of the entries in the WEIGHT_TREND_DAYS days ending on it.
export function weightTrend(entries: readonly BodyweightEntry[]): { date: string; kg: number; avg: number }[] {
  const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date));
  const days = sorted.map((e) => isoDay(e.date));
  let lo = 0;
  let sum = 0;
  // Sliding window: add each entry, drop those that fell out of the window.
  return sorted.map((e, i) => {
    sum += e.kg;
    while (days[i] - days[lo] >= WEIGHT_TREND_DAYS) sum -= sorted[lo++].kg;
    return { date: e.date, kg: e.kg, avg: sum / (i - lo + 1) };
  });
}

// Why a muscle's rank is below its volume rank, and what unlocks the next one. Null when nothing holds it back.
// A rank is the lower of volume (XP) and strength (benchmark lift ÷ bodyweight), and F without any bodyweight.
export function rankNote(m: Pick<MuscleProgress, 'xp' | 'rank' | 'strength'>, bodyweightKg: number | null): string | null {
  const v = volumeRank(m.xp);
  if (v === m.rank) return null;
  if (bodyweightKg === null) return `Volume says ${v}. Log your bodyweight to unlock ranks.`;
  if (m.strength === null) return null;
  const next = RANKS[RANKS.indexOf(m.strength) + 1];
  if (!next) return null;
  const kg = Math.ceil(XP.rankStrength[next] * bodyweightKg); // up: a rounded-down target would fall short
  return `Volume says ${v}, strength holds it at ${m.strength}. For ${next}: reach an estimated max of ${kg} kg (both dumbbells) on the benchmark lift in ${XP.rankUpSessions} sessions.`;
}
