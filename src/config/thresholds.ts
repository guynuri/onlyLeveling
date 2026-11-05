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

// Coach rules (SPEC §4). These are the spec defaults; each Wave 2 module edits only its own section.
export const COACH = {
  stallWeeks: 2, // no e1RM gain over this many weeks → stalled
  staleWeeks: 8, // the same exercise this long → stale
  tooEasyRir: 3, // RIR at or above this at the top of the range …
  tooEasySessions: 2, // … for this many sessions in a row → too easy
  missedSessionsForDeload: 3, // missed in a row before a deload is suggested (SPEC §4.1)
  deloadFactor: 0.9, // SPEC §4.1
} as const;
// XP (SPEC §4b). Numbers are open (SPEC §11 items 11 and 12). Phase 6 fills this section when they are decided.
export const XP = {} as const;
// Nutrition (SPEC §9, later phase). Blueprint only.
export const NUTRITION = {} as const;
