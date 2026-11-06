// What one exercise asks for in today's session: the engine's next prescription under the plan's target for that
// exercise, then an accepted coach weight, then the planned deload in the block's last week. Pure.
import { activeAdjustment, type Plan } from '../../domain/plan';
import { deloaded, isDeloadWeek, targetOf } from '../../domain/block';
import type { Exercise } from '../../domain/exercise';
import { nextPrescription, type Prescription } from '../../domain/progression';
import type { TemplateDay } from '../../domain/template';
import type { Settings, Workout } from '../../domain/types';
import { historyFor, progressionConfigFor } from './data';

export function prescribeFor(input: {
  plan: Plan;
  day: TemplateDay;
  ex: Exercise;
  settings: Settings;
  workouts: readonly Workout[];
  now: number;
}): Prescription {
  const { plan, ex } = input;
  const cfg = progressionConfigFor(ex, input.settings, targetOf(input.day, ex));
  const next = nextPrescription(historyFor(input.workouts, ex.id), cfg);
  const adj = activeAdjustment(plan, ex.id, input.workouts);
  const p = adj === null ? next : { ...next, w: adj };
  return isDeloadWeek(plan, input.now) ? deloaded(p, cfg.weighted !== false, cfg.owned) : p;
}
