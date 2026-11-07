// Swap candidates (SPEC §4, PLAN Phase 5): same movement pattern, same primary muscle, usable with the owned equipment, not
// avoided, not already in the plan. Recently used ones are de-preferred. Returns the single best, or null.
import { COACH } from '../../../config/thresholds';
import { movementPattern, usableWith, type Exercise } from '../../../domain/exercise';
import type { EquipmentChoice } from '../../../domain/types';

const WEEK = 7 * 86_400_000;

export interface SwapInput {
  exercise: Exercise;
  catalogue: readonly Exercise[];
  inPlan: ReadonlySet<string>;
  avoid: ReadonlySet<string>;
  equipment: readonly EquipmentChoice[];
  lastUsed: ReadonlyMap<string, number>; // exercise id → last logged epoch ms
  now: number;
}

// Ranked swap candidates: same primary muscle and usable kit, not avoided or in the plan. Same movement pattern first
// (when the exercise has one), then the same mechanic (compound/isolation), then not used recently, then least recently.
export function swapCandidates(input: SwapInput, limit = 8): Exercise[] {
  const { exercise: ex, now } = input;
  const pattern = movementPattern(ex);
  const muscle = ex.primaryMuscles[0];
  if (muscle === undefined) return [];
  const recentFrom = now - COACH.swapRecentWeeks * WEEK;
  const usable = input.catalogue.filter(
    (c) => c.id !== ex.id && usableWith(c, input.equipment) && c.primaryMuscles.includes(muscle) && !input.inPlan.has(c.id) && !input.avoid.has(c.id),
  );
  const key = (c: Exercise) => {
    const last = input.lastUsed.get(c.id) ?? -Infinity;
    return [
      pattern !== 'unknown' && movementPattern(c) === pattern ? 0 : 1,
      c.mechanic === ex.mechanic ? 0 : 1,
      last >= recentFrom ? 1 : 0,
      last,
    ];
  };
  return usable
    .map((c) => ({ c, k: key(c) }))
    .sort((a, b) => a.k[0] - b.k[0] || a.k[1] - b.k[1] || a.k[2] - b.k[2] || a.k[3] - b.k[3] || a.c.id.localeCompare(b.c.id))
    .slice(0, limit)
    .map((x) => x.c);
}

// The coach's single best swap: same movement pattern is required here (SPEC §4), so a card never proposes a
// different kind of movement.
export function pickSwap(input: SwapInput): Exercise | null {
  const pattern = movementPattern(input.exercise);
  if (pattern === 'unknown') return null;
  return swapCandidates(input, Infinity).find((c) => movementPattern(c) === pattern) ?? null;
}
