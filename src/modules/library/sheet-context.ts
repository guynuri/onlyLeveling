// What the exercise sheet reads: the saved plan (for Swap), history (for "Your last sessions"), what swaps must not
// offer (avoid list + limits) and which body figure to draw.
// Read-only on purpose: opening a sheet must never create or save a plan (currentPlan() would build and save one).
import type { Plan } from '../../domain/plan';
import type { Exercise } from '../../domain/exercise';
import type { Settings, Workout } from '../../domain/types';
import { blockedIds } from '../../domain/profile';

export interface SheetContext {
  plan: Plan | null; // null: nothing saved yet, so no Swap
  workouts: Workout[];
  blocked: string[];
  sex: 'male' | 'female';
  now: number;
}

export async function readSheetContext(
  repo: {
    getSettings(): Promise<Settings | undefined>;
    getPlan(): Promise<Plan | undefined>;
    listWorkouts(): Promise<Workout[]>;
  },
  now: number,
  catalogue: readonly Exercise[],
): Promise<SheetContext> {
  const [s, plan, workouts] = await Promise.all([repo.getSettings(), repo.getPlan(), repo.listWorkouts()]);
  return {
    plan: plan ?? null,
    workouts,
    blocked: s ? [...blockedIds(s, catalogue)] : [],
    sex: s?.about?.sex ?? 'male',
    now,
  };
}
