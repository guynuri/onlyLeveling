// What the exercise sheet reads: the saved plan (for Swap), history (for "Your last sessions") and the avoid list.
// Read-only on purpose: opening a sheet must never create or save a plan (currentPlan() would build and save one).
import type { Plan } from '../../domain/plan';
import type { Settings, Workout } from '../../domain/types';

export interface SheetContext {
  plan: Plan | null; // null: nothing saved yet, so no Swap
  workouts: Workout[];
  avoid: string[];
  now: number;
}

export async function readSheetContext(
  repo: {
    getSettings(): Promise<Settings | undefined>;
    getPlan(): Promise<Plan | undefined>;
    listWorkouts(): Promise<Workout[]>;
  },
  now: number,
): Promise<SheetContext> {
  const [s, plan, workouts] = await Promise.all([repo.getSettings(), repo.getPlan(), repo.listWorkouts()]);
  return { plan: plan ?? null, workouts, avoid: s?.avoid ?? [], now };
}
