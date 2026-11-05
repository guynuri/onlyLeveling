// Swap candidates (SPEC §4, PLAN Phase 5): same movement pattern, same primary muscle, dumbbell-compatible, not
// avoided, not already in the plan. Recently used ones are de-preferred. Returns the single best, or null.
import { COACH } from '../../../config/thresholds';
import { isDumbbellCompatible, movementPattern, type Exercise } from '../../../domain/exercise';

const WEEK = 7 * 86_400_000;

export interface SwapInput {
  exercise: Exercise;
  catalogue: readonly Exercise[];
  inPlan: ReadonlySet<string>;
  avoid: ReadonlySet<string>;
  lastUsed: ReadonlyMap<string, number>; // exercise id → last logged epoch ms
  now: number;
}

export function pickSwap(input: SwapInput): Exercise | null {
  const { exercise: ex, now } = input;
  const pattern = movementPattern(ex);
  const muscle = ex.primaryMuscles[0];
  if (pattern === 'unknown' || muscle === undefined) return null;
  const recentFrom = now - COACH.swapRecentWeeks * WEEK;
  const usable = input.catalogue.filter(
    (c) =>
      c.id !== ex.id &&
      isDumbbellCompatible(c) &&
      movementPattern(c) === pattern &&
      c.primaryMuscles.includes(muscle) &&
      !input.inPlan.has(c.id) &&
      !input.avoid.has(c.id),
  );
  const rank = (c: Exercise) => {
    const last = input.lastUsed.get(c.id) ?? -Infinity;
    return { recent: last >= recentFrom ? 1 : 0, last, id: c.id };
  };
  usable.sort((a, b) => {
    const ra = rank(a);
    const rb = rank(b);
    return ra.recent - rb.recent || ra.last - rb.last || ra.id.localeCompare(rb.id);
  });
  return usable[0] ?? null;
}
