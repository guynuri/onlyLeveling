// The weekly review (SPEC §5, PLAN Phase 2 of the spec): a short plain-text summary of a closed week. The prompt holds
// numbers only, and the answer is checked as plain text. Pure, shared by the Worker and the app.
import { MARKUP } from './ai-plan';

export const REVIEW_LIMITS = { textMax: 600 } as const;

// What the review is about. Numbers and counts only: no free text, no raw logs (SPEC §5.3).
export interface WeekFacts {
  week: string; // YYYY-MM-DD, the Monday that starts the closed week
  sessionsDone: number;
  sessionsPlanned: number;
  streakWeeks: number;
  openSwaps: number; // coach cards waiting for the user, shown below the review
}

export function reviewPrompt(f: WeekFacts): string {
  return [
    'Write a short review of one training week, in plain text, two or three sentences.',
    'Use only the numbers below. Do not invent a number, a muscle, or an exercise.',
    'Say what went well and one thing to keep an eye on. Training guidance, not medical advice.',
    'No HTML, no Markdown, no links. Reply with the text only.',
    `Week starting ${f.week}: ${f.sessionsDone} of ${f.sessionsPlanned} planned sessions finished.`,
    `Weeks in a row with a full week: ${f.streakWeeks}.`,
    `Coach suggestions waiting: ${f.openSwaps}.`,
  ].join('\n');
}

// The answer must be plain text of a sensible length. Anything else is rejected and the chain tries again.
export function validateReviewText(raw: string): { ok: true; text: string } | { ok: false; errors: string[] } {
  const text = raw.trim();
  if (text.length === 0 || text.length > REVIEW_LIMITS.textMax) {
    return { ok: false, errors: [`review must be 1 to ${REVIEW_LIMITS.textMax} characters`] };
  }
  if (MARKUP.test(text)) return { ok: false, errors: ['plain text only: no markup or links'] };
  return { ok: true, text };
}

// The fallback text when the AI is not used. It is built from the same numbers, so it says the same things.
export function rulesReviewText(f: WeekFacts): string {
  const done = `You finished ${f.sessionsDone} of ${f.sessionsPlanned} planned sessions.`;
  const streak = f.streakWeeks > 0 ? ` That is ${f.streakWeeks} ${f.streakWeeks === 1 ? 'week' : 'weeks'} in a row.` : '';
  const swaps = f.openSwaps > 0 ? ` ${f.openSwaps} coach ${f.openSwaps === 1 ? 'suggestion is' : 'suggestions are'} waiting below.` : '';
  return `${done}${streak}${swaps}`;
}
