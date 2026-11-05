// e1RM by Epley, only from sets of 12 reps or fewer (SPEC §3.5). Uses w and r only.
import { E1RM } from '../config/thresholds';

export function e1rm(w: number, r: number): number | null {
  if (!(w > 0) || !(r >= 1) || r > E1RM.maxReps) return null;
  return w * (1 + r / 30);
}

// A value is a record only when strictly above every value in history (SPEC §3.5).
export function isRecordE1RM(value: number | null, history: number[]): boolean {
  if (value === null) return false;
  if (history.length === 0) return true;
  return value > Math.max(...history);
}
