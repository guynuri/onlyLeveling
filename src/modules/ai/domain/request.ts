// What leaves the device for a plan proposal (SPEC §5.3): structured fields and library ids only. No dates of birth,
// no free text, no raw logs, no account identity. Pure.
import { isDumbbellCompatible, movementPattern, type Exercise } from '../../../domain/exercise';
import { repRangeFor } from '../../../domain/reps';
import type { Settings } from '../../../domain/types';
import { blockedIds, equipmentOf, goalsOf } from '../../../domain/profile';
import { PROFILE } from '../../../config/thresholds';
import type { Candidate } from '../../../../shared/ai-plan';
import type { PlanRequest } from '../../../../shared/ai-prompt';

// About you (sex, age, height) and bodyweight never leave the device. The limits note is the one free-text field
// (UX design §4), capped.
export function summaryOf(s: Settings): Record<string, unknown> {
  return {
    goals: goalsOf(s),
    daysPerWeek: s.daysPerWeek,
    sessionMinutes: s.sessionMinutes ?? null,
    experience: s.experience ?? 'returning',
    equipment: equipmentOf(s),
    owned: [...s.owned].sort((a, b) => a - b),
    avoid: s.avoid ?? [],
    limits: s.limits?.parts ?? [],
    limitsNote: (s.limits?.note ?? '').slice(0, PROFILE.limitsNoteMax),
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
    // Limits remove candidates here too: the AI never sees an exercise the rules would refuse.
    candidates: candidatesOf(catalogue, [...blockedIds(s, catalogue)]),
    daysPerWeek: s.daysPerWeek,
    exercisesPerDay,
    owned: [...s.owned],
    avoid,
  };
}
