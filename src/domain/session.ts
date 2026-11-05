// Logged sets (SPEC §7 SetRow). Pure judging rules only; storage is in data/.
export type SetPhase = 'work' | 'warmup';

export interface SetRow {
  w: number; // weight as entered, kg
  r: number; // reps done
  done: boolean;
  rir?: number;
  phase: SetPhase;
  at: number; // epoch ms
}

// A set is a hit only when done, at or above the target reps (SPEC §3.3).
export function isHit(set: SetRow, targetReps: number): boolean {
  return set.done && set.r >= targetReps;
}
