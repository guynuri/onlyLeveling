// Rep range by exercise type (SPEC §3.1). Mechanic unknown is treated as isolation (PLAN D10). Pure.
import { REP_RANGES } from '../config/thresholds';
import type { Exercise } from './exercise';

export function repRangeFor(ex: Pick<Exercise, 'mechanic'>): { min: number; max: number } {
  return ex.mechanic === 'compound' ? REP_RANGES.compound : REP_RANGES.isolation;
}
