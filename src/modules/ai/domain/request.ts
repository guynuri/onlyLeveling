// What leaves the device for a plan proposal (SPEC §5.3): structured fields and library ids only. No dates of birth,
// no free text, no raw logs, no account identity. Pure.
import { routineCatalogue } from '../../../domain/routine';
import { loadKind, movementPattern, usableWith, type Exercise } from '../../../domain/exercise';
import { repRangeFor } from '../../../domain/reps';
import type { Settings } from '../../../domain/types';
import { blockedIds, equipmentOf, goalsOf } from '../../../domain/profile';
import { AI_REQUEST, PROFILE, ROUTINE } from '../../../config/thresholds';
import type { Candidate } from '../../../../shared/ai-plan';
import type { PlanRequest } from '../../../../shared/ai-prompt';

// Body stats (sex, age, height, latest bodyweight) are sent so the AI can fit the plan (owner decision 2026-11-06,
// replacing SPEC §5.3's "no bodyweight"). The limits note is the one free-text field (UX design §4), capped.
// Never sent: account identity, dates of birth, raw logs.
export function summaryOf(s: Settings, bodyweightKg: number | null = null): Record<string, unknown> {
  return {
    body: { ...s.about, ...(bodyweightKg !== null ? { weightKg: bodyweightKg } : {}) },
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

const LEVEL_ORDER: Record<string, number> = { beginner: 0, intermediate: 1, expert: 2 };

// Takes `n` items spread over groups: each group in its own order, one from each group in turn. Keeps a short list
// varied (every muscle gets a few) instead of the first n of one kind. Pure.
export function spread<T>(items: readonly T[], groupOf: (t: T) => string, n: number): T[] {
  const groups = new Map<string, T[]>();
  for (const t of items) groups.set(groupOf(t), [...(groups.get(groupOf(t)) ?? []), t]);
  const queues = [...groups.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([, v]) => v);
  const out: T[] = [];
  for (let i = 0; out.length < n && queues.some((q) => q.length > i); i++) {
    for (const q of queues) if (q[i] !== undefined && out.length < n) out.push(q[i]);
  }
  return out;
}

// Library exercises usable with the owned equipment, with a known movement pattern, minus the avoid list. Only these
// reach the AI, at most AI_REQUEST.maxCandidates, spread over muscles, easier and compound ones first: a small model
// must fit the whole list and its answer in its context.
export function candidatesOf(catalogue: readonly Exercise[], avoid: readonly string[], s: Settings): Record<string, Candidate> {
  const skip = new Set(avoid);
  const equipment = equipmentOf(s);
  const out: Record<string, Candidate> = {};
  const usable = catalogue
    .filter((ex) => usableWith(ex, equipment) && movementPattern(ex) !== 'unknown' && !skip.has(ex.id))
    .sort(
      (a, b) =>
        (LEVEL_ORDER[a.level ?? 'intermediate'] ?? 1) - (LEVEL_ORDER[b.level ?? 'intermediate'] ?? 1) ||
        (a.mechanic === 'compound' ? 0 : 1) - (b.mechanic === 'compound' ? 0 : 1) ||
        a.id.localeCompare(b.id),
    );
  for (const ex of spread(usable, (e) => e.primaryMuscles[0] ?? '', AI_REQUEST.maxCandidates)) {
    const r = repRangeFor(ex);
    const kind = loadKind(ex);
    // Dumbbell work leaves `loads` out: the validator then uses the plan's owned list, and the prompt stays short.
    const loads = kind === 'dumbbell' ? undefined : kind === 'kettlebell' ? [...(s.ownedKettlebells ?? [])].sort((a, b) => a - b) : null;
    out[ex.id] = { name: ex.name, repMin: r.min, repMax: r.max, ...(loads === undefined ? {} : { loads }) };
  }
  return out;
}

// Warm-up and cool-down choices for the AI: every pulse raiser, then stretches spread over muscles.
function routineChoices(catalogue: readonly Exercise[]): Record<string, string> {
  const all = routineCatalogue(catalogue);
  const pulse = new Set<string>(ROUTINE.pulseIds);
  const picks = [...all.filter((e) => pulse.has(e.id)), ...spread(all.filter((e) => !pulse.has(e.id)), (e) => e.primaryMuscles[0] ?? '', AI_REQUEST.maxRoutine)];
  return Object.fromEntries(picks.map((e) => [e.id, e.name]));
}

export function buildPlanRequest(
  s: Settings,
  catalogue: readonly Exercise[],
  exercisesPerDay: number,
  bodyweightKg: number | null = null,
  supersets = false,
): PlanRequest {
  const avoid = s.avoid ?? [];
  const owned = [...s.owned].sort((a, b) => a - b);
  return {
    summary: summaryOf(s, bodyweightKg),
    // Limits remove candidates here too: the AI never sees an exercise the rules would refuse.
    candidates: candidatesOf(catalogue, [...blockedIds(s, catalogue)], s),
    daysPerWeek: s.daysPerWeek,
    exercisesPerDay,
    owned,
    avoid,
    supersets,
    routine: routineChoices(catalogue),
  };
}
