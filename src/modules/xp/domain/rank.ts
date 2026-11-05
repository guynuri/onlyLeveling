// Ranks (SPEC §4b). A muscle's rank is the lower of its volume rank (XP) and its strength rank (a benchmark lift as a
// multiple of bodyweight). A strength rank counts only when several separate sessions meet it. Without any bodyweight
// entry a muscle stays at F. Pure.
import { XP } from '../../../config/thresholds';

export const RANKS = ['F', 'E', 'D', 'C', 'B', 'A', 'S', 'SS', 'SSS'] as const;
export type Rank = (typeof RANKS)[number];

const index = (r: Rank) => RANKS.indexOf(r);

// The highest rank whose XP threshold the total has reached.
export function volumeRank(totalXp: number): Rank {
  let best: Rank = 'F';
  for (const r of RANKS) {
    if (totalXp >= XP.rankXp[r]) best = r;
  }
  return best;
}

// `ratios` is one value per session that had a bodyweight entry: the benchmark's estimated max ÷ bodyweight that day.
// Sessions without bodyweight are not in the list. The result is the highest rank that at least rankUpSessions
// separate sessions meet.
export function strengthRank(ratios: readonly number[]): Rank {
  let best: Rank = 'F';
  for (const r of RANKS) {
    const met = ratios.filter((v) => v >= XP.rankStrength[r]).length;
    if (met >= XP.rankUpSessions) best = r;
  }
  return best;
}

// The muscle's rank. `hasBodyweight` false → F (no rank-up without bodyweight, SPEC §4b).
// `strength` is null for groups without a benchmark lift: they rank on volume alone.
export function muscleRank(totalXp: number, strength: Rank | null, hasBodyweight: boolean): Rank {
  if (!hasBodyweight) return 'F';
  const v = volumeRank(totalXp);
  if (strength === null) return v;
  return index(v) <= index(strength) ? v : strength;
}

export function rankAtLeast(r: Rank, floor: Rank): boolean {
  return index(r) >= index(floor);
}
