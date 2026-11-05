// Double progression, per exercise (SPEC §3.3). Derived from history on every call, never stored.
import { ownedFloor, ownedUp } from './dumbbells';
import { isHit, type SetRow } from './session';

export interface Prescription {
  w: number;
  reps: number;
  sets: number;
}

// One finished session of this exercise. `target` is what the plan asked for that session.
export interface HistorySession {
  date: number; // epoch ms; history is ordered by this
  target: Prescription;
  sets: SetRow[];
}

export interface ProgressionConfig {
  repMin: number;
  repMax: number;
  sets: number;
  owned: readonly number[]; // owned weights, kg; empty = use the grid
  gridStep: number; // kg step when there is no owned list
  startWeight: number; // kg, for the first session
}

// Next session's prescription from history. Rules:
//  - Only the first `sets` working sets decide (extra sets never count).
//  - Session is a hit when every decisive set is done at or above the target reps.
//  - Hit at the top of the range: weight to the next owned bell (or +gridStep), reps back to the bottom.
//    At the heaviest owned bell there is no heavier one: weight holds and reps stay at the top.
//  - Hit below the top: same weight, reps +1 inside the range.
//  - Miss: same weight, same target.
export function nextPrescription(history: readonly HistorySession[], cfg: ProgressionConfig): Prescription {
  const sets = cfg.sets;
  if (history.length === 0) {
    return { w: snapWeight(cfg.startWeight, cfg), reps: cfg.repMin, sets };
  }
  const last = [...history].sort((a, b) => a.date - b.date).at(-1)!;
  // Warm-ups never decide: only working sets count, and only the first `sets` of them.
  const decisive = last.sets.filter((s) => s.phase === 'work').slice(0, last.target.sets);
  const targetReps = last.target.reps;
  const allHit = decisive.length > 0 && decisive.every((s) => isHit(s, targetReps));
  const w = last.target.w;

  if (!allHit) return { w: snapWeight(w, cfg), reps: targetReps, sets };

  if (targetReps >= cfg.repMax) {
    const up = nextWeightUp(w, cfg);
    if (up === null) return { w: snapWeight(w, cfg), reps: cfg.repMax, sets };
    return { w: up, reps: cfg.repMin, sets };
  }
  return { w: snapWeight(w, cfg), reps: Math.min(targetReps + 1, cfg.repMax), sets };
}

function nextWeightUp(w: number, cfg: ProgressionConfig): number | null {
  if (cfg.owned.length > 0) return ownedUp(cfg.owned, w);
  return w + cfg.gridStep;
}

// Always an owned weight when a list exists; otherwise the weight as given.
function snapWeight(w: number, cfg: ProgressionConfig): number {
  return cfg.owned.length > 0 ? ownedFloor(cfg.owned, w) : w;
}
