// What a session shows while it is logged and after it is finished (UX design §6.4): a live PR badge and the finish
// summary. Pure. XP and rank-ups come from the same Progress maths with and without the workout, so they always agree
// with the Progress screen.
import type { LiveExercise } from '../../../domain/live-session';
import type { BodySlug } from '../../../domain/muscle-map';
import { bestWeight } from '../../../domain/prs';
import type { HistorySession } from '../../../domain/progression';
import type { Workout } from '../../../domain/types';
import { GROUPS, type Group } from './muscles';
import { xpLoad } from './effectiveLoad';
import { bodyweightAt, computeProgress, type ProgressInput } from './progress';
import { RANKS, type Rank } from './rank';

// A set above everything lifted before. The first lift of an exercise is not a record, a timed set never is, and
// neither is a set with no weight. `history` must not include this session.
export function isLivePr(le: LiveExercise, history: readonly HistorySession[], setIndex: number): boolean {
  const set = le.sets[setIndex];
  if (!set || le.mode === 'time' || !set.done || set.phase !== 'work' || !(set.w > 0)) return false;
  const best = bestWeight(history);
  return best !== null && set.w > best;
}

export interface SessionSummary {
  minutes: number;
  volumeKg: number; // weight × reps over done working sets of rep-based exercises
  prExerciseIds: string[];
  xpByGroup: Record<Group, number>;
  xpTotal: number;
  primary: BodySlug[];
  secondary: BodySlug[];
  rankUps: { group: Group; from: Rank; to: Rank }[];
  usedDefaultBodyweight: boolean; // bodyweight sets were scored with the default bodyweight: the summary asks for one
}

export function summarize(input: ProgressInput & { workout: Workout }): SessionSummary {
  const { workout } = input;
  const history = input.workouts.filter((w) => w.id !== workout.id);
  const before = computeProgress({ ...input, workouts: history });
  const after = computeProgress({ ...input, workouts: [...history, workout] });

  const xpByGroup = Object.fromEntries(GROUPS.map((g) => [g, after.muscles[g].xp - before.muscles[g].xp])) as Record<Group, number>;
  const rankUps = GROUPS.flatMap((g) =>
    RANKS.indexOf(after.muscles[g].rank) > RANKS.indexOf(before.muscles[g].rank)
      ? [{ group: g, from: before.muscles[g].rank, to: after.muscles[g].rank }]
      : [],
  );

  let volumeKg = 0;
  const prExerciseIds: string[] = [];
  const primary = new Set<BodySlug>();
  const secondary = new Set<BodySlug>();
  const bodyweightKg = bodyweightAt(workout.start, input.bodyweight);
  let usedDefaultBodyweight = false;
  for (const e of workout.entries) {
    const done = e.sets.filter((s) => s.done && s.phase === 'work');
    if (done.length === 0) continue;
    const exercise = input.exerciseById(e.exerciseId);
    const timed = exercise?.mode === 'time';
    if (!timed) volumeKg += done.reduce((sum, s) => sum + s.w * s.r, 0);
    if (exercise) {
      const load = xpLoad(exercise, bodyweightKg);
      if (load.kind === 'fixed' && load.usedDefault) usedDefaultBodyweight = true;
      exercise.muscles.primary.forEach((m) => primary.add(m));
      exercise.muscles.secondary.forEach((m) => secondary.add(m));
    }
    if (!timed) {
      const past: HistorySession[] = history.flatMap((w) =>
        w.entries.filter((x) => x.exerciseId === e.exerciseId).map((x) => ({ date: w.start, target: x.planned, sets: x.sets })),
      );
      const best = bestWeight(past);
      const top = Math.max(0, ...done.map((s) => s.w));
      if (best !== null && top > best) prExerciseIds.push(e.exerciseId);
    }
  }

  return {
    minutes: Math.round((workout.end - workout.start) / 60_000),
    volumeKg,
    prExerciseIds,
    xpByGroup,
    xpTotal: GROUPS.reduce((sum, g) => sum + xpByGroup[g], 0),
    primary: [...primary],
    secondary: [...secondary].filter((s) => !primary.has(s)),
    rankUps,
    usedDefaultBodyweight,
  };
}
