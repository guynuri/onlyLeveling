// Turns a validated AI proposal into the saved plan (Phase 5 model, U4 additions). Days, labels and exercises come from
// the proposal; each exercise keeps the AI's sets and the library's rep range; each validated weight becomes its
// adjustment for the first session (none for reps-only work), then the engine takes over (SPEC §3.1). The goal blend
// adds cardio and mobility blocks the same way as for a rules plan. Pure.
import { ROUTINE } from '../../../config/thresholds';
import { planFromTemplate, type Plan, type Adjustment } from '../../../domain/plan';
import { applyBlend } from '../../../domain/plan-builder';
import { goalsOf } from '../../../domain/profile';
import type { TemplateDay } from '../../../domain/template';
import type { Settings } from '../../../domain/types';
import type { ValidPlan } from '../../../../shared/ai-plan';

export function planFromProposal(
  v: ValidPlan,
  s: Settings,
  weeks: number,
  repRange: (exerciseId: string) => { min: number; max: number },
  now: number,
): Plan {
  const days: TemplateDay[] = v.days.map((d, index) => ({
    index,
    label: d.label,
    warmup: ROUTINE.warmup.map((r) => ({ ...r })),
    exerciseIds: d.exercises.map((e) => e.exerciseId),
    targets: Object.fromEntries(
      d.exercises.map((e) => {
        const r = repRange(e.exerciseId);
        return [e.exerciseId, { sets: e.sets, repMin: r.min, repMax: r.max }];
      }),
    ),
    cooldown: ROUTINE.cooldown.map((r) => ({ ...r })),
  }));
  const adjustments: Adjustment[] = [];
  for (const d of v.days) {
    for (const e of d.exercises) {
      if (e.w > 0 && !adjustments.some((a) => a.exerciseId === e.exerciseId)) {
        adjustments.push({ exerciseId: e.exerciseId, w: e.w, at: now });
      }
    }
  }
  return {
    ...planFromTemplate(applyBlend(days, goalsOf(s)), s.daysPerWeek, now),
    adjustments,
    block: { weeks, startedAt: now, deloadLastWeek: true },
    schedule: 'rotation',
  };
}
