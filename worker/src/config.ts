// Worker thresholds, all in one place (CLAUDE.md "Domain rules": no magic numbers elsewhere).
export const AUTH = {
  pbkdf2Iterations: 100_000, // raise over time; each stored hash keeps its own count
  minPasswordLength: 10,
  sessionDays: 30,
  rateLimit: {
    windowSec: 15 * 60, // a window for each (action, IP)
    maxAttempts: 10, // per window, for sign-in, sign-up and recovery
  },
} as const;
