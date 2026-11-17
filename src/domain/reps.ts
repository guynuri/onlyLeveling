// Rep range by exercise type (SPEC §3.1). Mechanic unknown is treated as isolation (PLAN D10). A timed hold's range is
// seconds (owner decision 2026-11-17). Pure.
import { REP_RANGES } from '../config/thresholds';
import type { Exercise } from './exercise';

export function repRangeFor(ex: Pick<Exercise, 'mechanic'> & Partial<Pick<Exercise, 'mode'>>): { min: number; max: number } {
  if (ex.mode === 'time') return REP_RANGES.hold;
  return ex.mechanic === 'compound' ? REP_RANGES.compound : REP_RANGES.isolation;
}
