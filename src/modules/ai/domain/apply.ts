// Turns a validated AI proposal into the saved plan (Phase 5 model). Days and exercises come from the proposal; each
// exercise's validated weight becomes its adjustment for the first session, then the engine takes over (SPEC §3.1).
// Pure.
import { ROUTINE } from '../../../config/thresholds';
import { planFromTemplate, type Plan, type Adjustment } from '../../../domain/plan';
import type { TemplateDay } from '../../../domain/template';
import type { ValidPlan } from '../../../../shared/ai-plan';

export function planFromProposal(v: ValidPlan, daysPerWeek: number, now: number): Plan {
  const days: TemplateDay[] = v.days.map((d, index) => ({
    index,
    warmup: ROUTINE.warmup.map((r) => ({ ...r })),
    exerciseIds: d.exercises.map((e) => e.exerciseId),
    cooldown: ROUTINE.cooldown.map((r) => ({ ...r })),
  }));
  const adjustments: Adjustment[] = [];
  for (const d of v.days) {
    for (const e of d.exercises) {
      if (!adjustments.some((a) => a.exerciseId === e.exerciseId)) {
        adjustments.push({ exerciseId: e.exerciseId, w: e.w, at: now });
      }
    }
  }
  return { ...planFromTemplate(days, daysPerWeek, now), adjustments };
}
