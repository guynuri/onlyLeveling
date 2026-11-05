// All numeric thresholds live here (CLAUDE.md "Domain rules"). Empty per module until their phase.

export const OUTBOX = {
  // Exponential backoff for failed pushes: base * 2^attempts, capped.
  backoffBaseMs: 1_000,
  backoffCapMs: 5 * 60_000,
} as const;

export const TRAINING = {} as const;
export const COACH = {} as const;
export const NUTRITION = {} as const;
export const XP = {} as const;
