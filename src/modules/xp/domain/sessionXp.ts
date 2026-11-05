// XP for one finished session, per muscle group (SPEC §4b). Primary muscles get the set XP, secondary muscles a share,
// a flat bonus when an exercise reached top-of-range reps, and a cap per muscle per session.
import { XP } from '../../../config/thresholds';
import type { Exercise } from '../../../domain/exercise';
import type { Prescription } from '../../../domain/progression';
import { isHit, type SetRow } from '../../../domain/session';
import { groupOf, bellsFor, GROUPS, type Group } from './muscles';
import { setXp } from './setXp';

export interface SessionEntry {
  exercise: Exercise;
  planned: Prescription;
  sets: SetRow[];
}

export type GroupXp = Record<Group, number>;

export interface SessionXpResult {
  byGroup: GroupXp;
  flaggedSets: number;
}

export function emptyGroupXp(): GroupXp {
  return Object.fromEntries(GROUPS.map((g) => [g, 0])) as GroupXp;
}

// `recentBest(exerciseId)` = best working weight in the window before this session; `repMaxFor` = top of the range.
export function sessionXp(
  entries: readonly SessionEntry[],
  recentBest: (exerciseId: string) => number | null,
  repMaxFor: (exerciseId: string) => number,
): SessionXpResult {
  const byGroup = emptyGroupXp();
  let flaggedSets = 0;
  for (const e of entries) {
    const bells = bellsFor(e.exercise);
    const best = recentBest(e.exercise.id);
    let exerciseXp = 0;
    let flagged = 0;
    for (const set of e.sets) {
      const r = setXp(set, e.planned.reps, bells, best);
      exerciseXp += r.xp;
      if (r.flagged) flagged++;
    }
    flaggedSets += flagged;

    // Progression bonus: every decisive working set hit target, and the target was the top of the range.
    const decisive = e.sets.filter((s) => s.phase === 'work').slice(0, e.planned.sets);
    const topOfRange = e.planned.reps >= repMaxFor(e.exercise.id);
    const hitAll = decisive.length > 0 && decisive.every((s) => isHit(s, e.planned.reps) && s.r <= XP.overRepsCap);
    const bonus = topOfRange && hitAll ? XP.progressionBonus : 0;

    const primary = unique(e.exercise.primaryMuscles.map(groupOf));
    const secondary = unique(e.exercise.secondaryMuscles.map(groupOf)).filter((g) => !primary.includes(g));
    for (const g of primary) byGroup[g] += exerciseXp + bonus;
    for (const g of secondary) byGroup[g] += exerciseXp * XP.secondaryFactor;
  }
  for (const g of GROUPS) byGroup[g] = Math.min(byGroup[g], XP.sessionCapPerMuscle);
  return { byGroup, flaggedSets };
}

function unique(groups: (Group | null)[]): Group[] {
  return [...new Set(groups.filter((g): g is Group => g !== null))];
}
