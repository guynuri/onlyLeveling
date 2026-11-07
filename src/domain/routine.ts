// Warm-up and cool-down as real exercises (owner request 2026-11-07). Rules pick them from the library for the day's
// muscles: a short pulse raiser, then easy stretches for the two most-worked muscles; the cool-down stretches the three
// most-worked muscles. The AI may pick them instead (marked `by: 'ai'`), and the plan's validator only lets library
// stretches and pulse raisers through. Rules routines are derived on every read, so they follow edits to the day.
// Pure and deterministic.
import { ROUTINE } from '../config/thresholds';
import type { Exercise } from './exercise';
import type { Plan } from './plan';
import type { RoutineItem, TemplateDay } from './template';

const NO_KIT = new Set(['bodyweight', 'unknown']);

// Stretches anyone can do at home: no kit, beginner-friendly.
export function isStretch(e: Exercise): boolean {
  return e.category === 'stretching' && e.requires.length === 0 && NO_KIT.has(e.equipment) && e.level !== 'expert';
}

// The exercises the AI may pick for a warm-up or cool-down.
export function routineCatalogue(catalogue: readonly Exercise[]): Exercise[] {
  const pulse = new Set<string>(ROUTINE.pulseIds);
  // Never RepDB records: their text does not go to an LLM (CLAUDE.md licence table).
  return catalogue.filter((e) => e.source !== 'repdb' && e.textSource !== 'repdb' && (isStretch(e) || pulse.has(e.id)));
}

// Raw muscle names, most-worked first (primary counts 2, secondary 1); ties by name.
function topMuscles(day: readonly Exercise[]): string[] {
  const score = new Map<string, number>();
  for (const e of day) {
    for (const m of e.primaryMuscles) score.set(m, (score.get(m) ?? 0) + 2);
    for (const m of e.secondaryMuscles) score.set(m, (score.get(m) ?? 0) + 1);
  }
  return [...score].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([m]) => m);
}

const item = (e: Exercise, seconds: number): RoutineItem => ({ name: e.name, seconds, exerciseId: e.id });

export function rulesRoutine(day: readonly Exercise[], catalogue: readonly Exercise[], dayIndex: number): { warmup: RoutineItem[]; cooldown: RoutineItem[] } {
  const stretches = catalogue.filter(isStretch).sort((a, b) => a.id.localeCompare(b.id));
  const muscles = topMuscles(day);
  const used = new Set<string>();
  // One stretch per muscle; the day's index rotates the choice so different days get different stretches.
  const stretchFor = (m: string): Exercise | undefined => {
    const fits = stretches.filter((s) => s.primaryMuscles.includes(m) && !used.has(s.id));
    const pick = fits[dayIndex % Math.max(1, fits.length)];
    if (pick) used.add(pick.id);
    return pick;
  };
  // Stops at n, so stretches for less-worked muscles stay free for the cool-down.
  const pick = (n: number, seconds: number) => {
    const out: RoutineItem[] = [];
    for (const m of muscles) {
      if (out.length >= n) break;
      const e = stretchFor(m);
      if (e) out.push(item(e, seconds));
    }
    return out;
  };

  const pulses = ROUTINE.pulseIds.map((id) => catalogue.find((e) => e.id === id)).filter((e): e is Exercise => e !== undefined);
  const pulse = pulses[dayIndex % Math.max(1, pulses.length)];
  const warmup = [...(pulse ? [item(pulse, ROUTINE.pulseSeconds)] : []), ...pick(ROUTINE.warmupStretches, ROUTINE.warmupStretchSeconds)];
  const cooldown = pick(ROUTINE.cooldownStretches, ROUTINE.cooldownStretchSeconds);
  return {
    warmup: warmup.length > 0 ? warmup : ROUTINE.warmup.map((r) => ({ ...r })),
    cooldown: cooldown.length > 0 ? cooldown : ROUTINE.cooldown.map((r) => ({ ...r })),
  };
}

const byAi = (items: readonly RoutineItem[]) => items.length > 0 && items.every((r) => r.by === 'ai');

// Fills every lifting day's routine from the rules, except a part the AI picked.
export function withRoutines(plan: Plan, catalogue: readonly Exercise[]): Plan {
  const byId = new Map(catalogue.map((e) => [e.id, e]));
  const days = plan.days.map((d): TemplateDay => {
    if (d.kind === 'cardio') return d;
    const r = rulesRoutine(
      d.exerciseIds.map((id) => byId.get(id)).filter((e): e is Exercise => e !== undefined),
      catalogue,
      d.index,
    );
    return { ...d, warmup: byAi(d.warmup) ? d.warmup : r.warmup, cooldown: byAi(d.cooldown) ? d.cooldown : r.cooldown };
  });
  return { ...plan, days };
}
