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
