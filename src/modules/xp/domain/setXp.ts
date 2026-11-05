// XP for one set (SPEC §4b). Load × credited reps, where reps beyond the target earn less each time.
// Pure: no storage, no clock.
import { XP } from '../../../config/thresholds';
import type { SetRow } from '../../../domain/session';

export interface SetXp {
  xp: number;
  flagged: boolean; // a set above the rep cap: earns 0 and is shown as suspicious
}

// Reps credited toward XP. Below target → 0. At target → target. Each extra rep adds decay^k, so each is worth less
// than the one before (strictly decreasing). Above the cap → 0 and flagged.
export function creditedReps(reps: number, target: number): { credited: number; flagged: boolean } {
  if (reps > XP.overRepsCap) return { credited: 0, flagged: true };
  if (reps < target) return { credited: 0, flagged: false };
  const extra = reps - target;
  let credited = target;
  let step = 1;
  for (let k = 0; k < extra; k++) {
    credited += step;
    step *= XP.extraRepDecay;
  }
  return { credited, flagged: false };
}

// `bells` is 1 or 2 (one-arm work counts one bell). `recentBest` is the best working weight in the window before this
// session (null when there is none): a set below it earns w/best, never less than weightDropFloor.
export function setXp(set: SetRow, target: number, bells: 1 | 2, recentBest: number | null): SetXp {
  if (!set.done || set.phase !== 'work') return { xp: 0, flagged: false };
  const { credited, flagged } = creditedReps(set.r, target);
  if (credited === 0) return { xp: 0, flagged };
  const load = set.w * bells;
  const drop = recentBest !== null && set.w < recentBest ? Math.max(XP.weightDropFloor, set.w / recentBest) : 1;
  return { xp: load * credited * drop, flagged };
}
