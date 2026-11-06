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
  stallMinSessions: 2, // sessions needed inside the stall window before it can fire
  staleWeeks: 8, // the same exercise this long → stale
  tooEasyRir: 3, // RIR at or above this at the top of the range …
  tooEasySessions: 2, // … for this many sessions in a row → too easy
  missedSessionsForDeload: 3, // missed in a row before a deload is suggested (SPEC §4.1)
  deloadFactor: 0.9, // SPEC §4.1
  deloadMinFactor: 0.5, // deload factor is clamped to this range
  deloadMaxFactor: 0.95,
  notNowDays: 7, // "Not now" hides a suggestion for this long
  swapRecentWeeks: 4, // a swap candidate used within this many weeks is de-preferred
} as const;
// XP and ranks (SPEC §4b, PLAN Phase 6). Numbers are our proposal (SPEC §11 items 11 and 12), tuned with real logs.
// Scale: a set's XP is load (kg, both bells) × credited reps, so one 12-week run lands in the thousands.
// B is a rough guide, not a target: F → B should take well over 12 weeks.
export const XP = {
  overRepsCap: 30, // a set above this earns 0 and is flagged (SPEC §4b anti-cheese)
  extraRepDecay: 0.8, // each rep beyond target earns this times the one before (strictly less each time)
  weightDropFloor: 0.5, // a set below the recent best weight earns w/best, never less than this
  weightDropWindowWeeks: 4, // "recent best" = best working weight in this many weeks before the session
  secondaryFactor: 0.4, // secondary muscles earn this share of a set (REFERENCE_NOTES §6)
  sessionCapPerMuscle: 3000, // XP one muscle can earn from one session
  progressionBonus: 150, // flat XP for an exercise that reached top-of-range reps on every decisive set
  // Volume rank: cumulative XP on a muscle to reach each rank.
  rankXp: { F: 0, E: 5_000, D: 15_000, C: 35_000, B: 70_000, A: 120_000, S: 200_000, SS: 320_000, SSS: 480_000 },
  // Strength rank: best benchmark-lift estimated max ÷ bodyweight, lowest multiple per rank.
  rankStrength: { F: 0, E: 0.3, D: 0.5, C: 0.75, B: 1.0, A: 1.25, S: 1.5, SS: 1.75, SSS: 2.0 },
  // A strength rank counts only when this many separate sessions meet it (one lucky set does not count).
  rankUpSessions: 2,
  bodyweightWindowDays: 7, // a bodyweight entry this old or newer counts for a session
  badgeSessionMilestones: [1, 10, 100], // "first session", then 10 and 100 sessions
  badgeRankFrom: 'C', // achievement badges per muscle start at this rank
} as const;
// Profile and onboarding v2 (UX design §4). Weight grids are what the chip grids offer.
export const PROFILE = {
  dumbbellGrid: [
    1, 2, 2.5, 3, 4, 5, 6, 7, 7.5, 8, 9, 10, 11, 12, 12.5, 13, 14, 15, 16, 17.5, 18, 20, 22, 22.5, 24, 25, 26, 27.5, 28,
    30, 32, 32.5, 34, 35, 36, 37.5, 40, 42.5, 44, 45, 47.5, 50,
  ],
  kettlebellGrid: [4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 32, 36, 40, 44, 48],
  about: { age: [13, 100], heightCm: [100, 250], weightKg: [30, 300] },
  maxCustomWeightKg: 100, // a typed-in bell weight above this is a typo
  limitsNoteMax: 200,
} as const;

// Goal blend (UX design §4): goals are a set; each asks for this much, and the blend takes the most of each.
// The goals themselves go to the AI, which shapes the plan; this table is the fail-safe for the rules plan (no AI,
// or an AI answer that fails validation). Owner decision, 2026-11-06.
export const GOAL_BLEND = {
  'build-muscle': { cardioSessions: 0, cardioMinutes: 0, mobilityMinutes: 0, repBias: 'none' },
  strength: { cardioSessions: 0, cardioMinutes: 0, mobilityMinutes: 0, repBias: 'heavier' },
  'lose-fat': { cardioSessions: 2, cardioMinutes: 20, mobilityMinutes: 0, repBias: 'none' },
  endurance: { cardioSessions: 2, cardioMinutes: 30, mobilityMinutes: 0, repBias: 'lighter' },
  mobility: { cardioSessions: 0, cardioMinutes: 0, mobilityMinutes: 5, repBias: 'none' },
  health: { cardioSessions: 1, cardioMinutes: 20, mobilityMinutes: 5, repBias: 'none' },
} as const;

// Limits (UX design §4): a sore body part removes exercises whose primary muscles load it, unless RepDB marks the
// exercise safe for that joint. Conservative on purpose; the user reviews this table. Training guidance only.
export const LIMIT_RULES = {
  shoulder: { slugs: ['deltoids'], safeTag: 'shoulder_safe' },
  elbow: { slugs: ['triceps', 'biceps'] },
  wrist: { slugs: ['forearm'] },
  'lower-back': { slugs: ['lower-back'], safeTag: 'lower_back_safe' },
  hip: { slugs: ['gluteal', 'adductors', 'hip-flexors'] },
  knee: { slugs: ['quadriceps'], safeTag: 'knee_safe' },
  ankle: { slugs: ['calves', 'tibialis'] },
  neck: { slugs: ['trapezius'] },
} as const;

// Nutrition (SPEC §9, later phase). Blueprint only.
export const NUTRITION = {} as const;
