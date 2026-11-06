// XP for one finished session, per muscle group (SPEC §4b). Primary muscles get the set XP, secondary muscles a share,
// a flat bonus when an exercise reached top-of-range reps, and a cap per muscle per session.
import { XP } from '../../../config/thresholds';
import type { Exercise } from '../../../domain/exercise';
import type { Prescription } from '../../../domain/progression';
import { isHit, type SetRow } from '../../../domain/session';
import { groupOf, bellsFor, GROUPS, type Group } from './muscles';
import { xpLoad } from './effectiveLoad';
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
  usedDefaultBodyweight: boolean; // a bodyweight exercise was scored with the default bodyweight (none logged)
}

export function emptyGroupXp(): GroupXp {
  return Object.fromEntries(GROUPS.map((g) => [g, 0])) as GroupXp;
}

// `recentBest(exerciseId)` = best working weight in the window before this session; `repMaxFor` = top of the range.
export function sessionXp(
  entries: readonly SessionEntry[],
  recentBest: (exerciseId: string) => number | null,
  repMaxFor: (exerciseId: string) => number,
  bodyweightKg: number | null = null,
): SessionXpResult {
  const byGroup = emptyGroupXp();
  let flaggedSets = 0;
  let usedDefaultBodyweight = false;
  for (const e of entries) {
    const load = xpLoad(e.exercise, bodyweightKg);
    if (load.kind === 'timed') continue; // holds earn no muscle XP, and their seconds are not reps
    // Unweighted work is scored at a fixed load (a share of bodyweight, or a band), on one "bell".
    const bells = load.kind === 'fixed' ? 1 : bellsFor(e.exercise);
    const best = load.kind === 'fixed' ? null : recentBest(e.exercise.id);
    if (load.kind === 'fixed' && load.usedDefault && e.sets.some((s) => s.done && s.phase === 'work')) usedDefaultBodyweight = true;
    let exerciseXp = 0;
    let flagged = 0;
    for (const set of e.sets) {
      const scored = load.kind === 'fixed' ? { ...set, w: load.kg } : set;
      const r = setXp(scored, e.planned.reps, bells, best);
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
  return { byGroup, flaggedSets, usedDefaultBodyweight };
}

function unique(groups: (Group | null)[]): Group[] {
  return [...new Set(groups.filter((g): g is Group => g !== null))];
}
