// Rep range by exercise type (SPEC §3.1). Mechanic unknown is treated as isolation (PLAN D10). A timed hold's range is
// seconds; core and calf work gets the calves-and-core range (owner decision 2026-11-17). Pure.
import { REP_RANGES } from '../config/thresholds';
import { groupOf } from '../modules/xp/domain/muscles';
import type { Exercise } from './exercise';

// Every main muscle is core (abs) or calves.
const coreOrCalves = (primary: readonly string[] | undefined): boolean =>
  !!primary && primary.length > 0 && primary.every((m) => groupOf(m) === 'core' || groupOf(m) === 'calves');

export function repRangeFor(ex: Pick<Exercise, 'mechanic'> & Partial<Pick<Exercise, 'mode' | 'primaryMuscles'>>): { min: number; max: number } {
  if (ex.mode === 'time') return REP_RANGES.hold;
  if (coreOrCalves(ex.primaryMuscles)) return REP_RANGES.calvesAndCore;
  return ex.mechanic === 'compound' ? REP_RANGES.compound : REP_RANGES.isolation;
}

// Top of an exercise's rep range as the plan sets it: the first target the plan holds for it, else the library default
// (0 for an unknown id). The coach's "too easy" check and the XP progression bonus read this, so they agree with what
// progression uses (training/data.ts progressionConfigFor), and a change to the library ranges does not rewrite the
// history of exercises the plan still holds.
export function repMaxIn(
  plan: { days: readonly { targets?: Record<string, { repMax: number }> }[] } | null | undefined,
  byId: (id: string) => (Pick<Exercise, 'mechanic'> & Partial<Pick<Exercise, 'mode' | 'primaryMuscles'>>) | undefined,
): (id: string) => number {
  return (id) => {
    const target = plan?.days.find((d) => d.targets?.[id])?.targets?.[id];
    if (target) return target.repMax;
    const ex = byId(id);
    return ex ? repRangeFor(ex).max : 0;
  };
}
