// What leaves the device for a plan proposal (SPEC §5.3): structured fields and library ids only. No dates of birth,
// no free text, no raw logs, no account identity. Pure.
import { isDumbbellCompatible, movementPattern, type Exercise } from '../../../domain/exercise';
import { repRangeFor } from '../../../domain/reps';
import type { Settings } from '../../../domain/types';
import type { Candidate } from '../../../../shared/ai-plan';
import type { PlanRequest } from '../../../../shared/ai-prompt';

export function summaryOf(s: Settings): Record<string, unknown> {
  return {
    goal: s.goal ?? 'build-muscle',
    daysPerWeek: s.daysPerWeek,
    sessionMinutes: s.sessionMinutes ?? null,
    experience: s.experience ?? 'returning',
    owned: [...s.owned].sort((a, b) => a - b),
    avoid: s.avoid ?? [],
    trends: [], // first plan: no history yet (SPEC §5.3 per-exercise trends come with later proposals)
  };
}

// Dumbbell-compatible library exercises with a known movement pattern, minus the avoid list. Only these reach the AI.
export function candidatesOf(catalogue: readonly Exercise[], avoid: readonly string[]): Record<string, Candidate> {
  const skip = new Set(avoid);
  const out: Record<string, Candidate> = {};
  for (const ex of catalogue) {
    if (!isDumbbellCompatible(ex) || movementPattern(ex) === 'unknown' || skip.has(ex.id)) continue;
    const r = repRangeFor(ex);
    out[ex.id] = { name: ex.name, repMin: r.min, repMax: r.max };
  }
  return out;
}

export function buildPlanRequest(s: Settings, catalogue: readonly Exercise[], exercisesPerDay: number): PlanRequest {
  const avoid = s.avoid ?? [];
  return {
    summary: summaryOf(s),
    candidates: candidatesOf(catalogue, avoid),
    daysPerWeek: s.daysPerWeek,
    exercisesPerDay,
    owned: [...s.owned],
    avoid,
  };
}
