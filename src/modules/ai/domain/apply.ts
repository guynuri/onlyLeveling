// Turns a validated AI proposal into the saved plan (Phase 5 model, U4 additions). Days, labels and exercises come from
// the proposal; each exercise keeps the AI's sets and the library's rep range; each validated weight becomes its
// adjustment for the first session (none for reps-only work), then the engine takes over (SPEC §3.1). The goal blend
// adds cardio and mobility blocks the same way as for a rules plan. Pure.
import { ROUTINE } from '../../../config/thresholds';
import { planFromTemplate, type Plan, type Adjustment } from '../../../domain/plan';
import { applyBlend } from '../../../domain/plan-builder';
import { goalsOf } from '../../../domain/profile';
import type { RoutineItem, TemplateDay } from '../../../domain/template';
import { getExercise } from '../../../data/exercises';
import type { Settings } from '../../../domain/types';
import type { ValidPlan } from '../../../../shared/ai-plan';

// The AI's validated warm-up or cool-down ids as routine items; a pulse raiser gets its longer time. Null: none picked,
// the rules fill it (domain/routine.ts withRoutines).
function aiRoutine(ids: readonly string[] | undefined, seconds: number): RoutineItem[] | null {
  if (!ids || ids.length === 0) return null;
  const pulse = new Set<string>(ROUTINE.pulseIds);
  return ids.map((id) => ({ name: getExercise(id)?.name ?? id, seconds: pulse.has(id) ? ROUTINE.pulseSeconds : seconds, exerciseId: id, by: 'ai' as const }));
}

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
    warmup: aiRoutine(d.warmup, ROUTINE.warmupStretchSeconds) ?? ROUTINE.warmup.map((r) => ({ ...r })),
    exerciseIds: d.exercises.map((e) => e.exerciseId),
    ...(d.supersets ? { supersets: d.supersets } : {}),
    targets: Object.fromEntries(
      d.exercises.map((e) => {
        const r = repRange(e.exerciseId);
        return [e.exerciseId, { sets: e.sets, repMin: r.min, repMax: r.max }];
      }),
    ),
    cooldown: aiRoutine(d.cooldown, ROUTINE.cooldownStretchSeconds) ?? ROUTINE.cooldown.map((r) => ({ ...r })),
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
