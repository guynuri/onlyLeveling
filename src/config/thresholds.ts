// All numeric thresholds live here (CLAUDE.md "Domain rules"). One section per module.

export const OUTBOX = {
  // Exponential backoff for failed pushes: base * 2^attempts, capped.
  backoffBaseMs: 1_000,
  backoffCapMs: 5 * 60_000,
} as const;

// Training (SPEC §2, §3). Rep ranges are a default table, editable per exercise later.
export const TRAINING = {
  restSec: 90, // 0 = rest timer off
  restPauseSec: 15,
  defaultSets: 3,
  gridStepKg: 2, // weight step when no owned list exists
  startWeightKg: 6,
  // Starting settings until the user edits them (onboarding is Phase 7). Owned weights are a placeholder set.
  defaultDaysPerWeek: 3,
  defaultOwnedKg: [4, 6, 8, 10, 12, 14, 16],
} as const;

// Rep ranges by exercise type (SPEC §3.1). Proposal, tuned with real logs (SPEC §11 item 1).
export const REP_RANGES = {
  compound: { min: 6, max: 10 },
  isolation: { min: 10, max: 15 },
  calvesAndCore: { min: 10, max: 20 },
} as const;

// Double progression policy (SPEC §3.3). "double" is the only policy in Phase 3.
export const PROGRESSION = {
  policy: 'double',
  sets: TRAINING.defaultSets,
  gridStepKg: TRAINING.gridStepKg,
} as const;

// e1RM (SPEC §3.5): Epley only, from sets of this many reps or fewer.
export const E1RM = {
  maxReps: 12,
} as const;

// Template plans (PLAN Phase 3). Session length limits exercises per day.
export const TEMPLATE = {
  exercisesPerDay: 4,
} as const;

// Warm-up and cool-down are separate blocks of every session, never part of the exercise list and never
// counted in progression or PRs. Names and durations are a proposal, to tune with real use.
export const ROUTINE = {
  warmup: [
    { name: 'Light cardio', seconds: 300 },
    { name: 'Dynamic mobility', seconds: 180 },
  ],
  cooldown: [
    { name: 'Easy walk', seconds: 300 },
    { name: 'Static stretch', seconds: 240 },
  ],
} as const;

export const COACH = {} as const;
export const NUTRITION = {} as const;
export const XP = {} as const;
