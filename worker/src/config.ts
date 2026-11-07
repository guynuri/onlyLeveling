// Worker thresholds, all in one place (CLAUDE.md "Domain rules": no magic numbers elsewhere).
// AI (SPEC §5.2, §5.7, PLAN Phase 7). Provider order is the chain in ai/chain.ts. Model names change over time:
// check the Workers AI catalogue before deploy.
export const AI = {
  model: '@cf/meta/llama-3.1-8b-instruct',
  dailyCap: 5, // plan proposals per user per UTC day, counting failed calls
  timeoutMs: 25_000,
  // Workers AI answers stop at 256 tokens by default, which cuts a plan's JSON short; a 5-day plan needs ~1,500.
  maxTokens: 2_048,
} as const;

// Push (PLAN Phase 9). The subject is a contact URL the push services may use (RFC 8292).
export const PUSH = {
  restStaleMs: 10 * 60_000, // a rest alert more than this late is dropped, not sent
  reminderWindowMin: 30, // a reminder is due from its set minute for this long, so a late cron run still sends
  restMaxAheadMs: 3 * 60 * 60_000, // a rest cannot end more than this far in the future
  vapidSubject: 'https://guynuri.github.io/onlyLeveling/',
} as const;

export const AUTH = {
  pbkdf2Iterations: 100_000, // raise over time; each stored hash keeps its own count
  minPasswordLength: 10,
  sessionDays: 30,
  rateLimit: {
    windowSec: 15 * 60, // a window for each (action, IP)
    maxAttempts: 10, // per window, for sign-in, sign-up and recovery
  },
} as const;
