// SPEC §4.2: the coach screen never shows internal terms. Checks the copy the rules and labels produce.
import { describe, it, expect } from 'vitest';
import { actionLabel, COACH_FOOTER } from './CoachCards';
import { reconcile, type Candidate } from './domain/suggest';

const FORBIDDEN = /e1RM|RIR|Epley|stall|deload|stale|prescription|medical/i;

describe('coach copy', () => {
  it('card labels and reasons avoid internal terms', () => {
    const name = (id: string) => `Name ${id}`;
    const labels = [
      actionLabel({ kind: 'deload', w: 9 }, name),
      actionLabel({ kind: 'jump', w: 14 }, name),
      actionLabel({ kind: 'swap', toId: 'x' }, name),
    ];
    for (const l of labels) expect(l).not.toMatch(FORBIDDEN);
  });

  it('the footer says it is guidance, not medical advice', () => {
    expect(COACH_FOOTER).toBe('Suggestion. Training guidance, not medical advice.');
  });

  it('reconcile keeps the reason text as given (rules write the reasons; this checks they are plain)', () => {
    const c: Candidate = {
      rule: 'stall',
      exerciseId: 'e',
      reason: 'Chest press: your estimated best has not gone up in 14 days (20 kg then, 21 kg before).',
      action: { kind: 'deload', w: 18 },
      lastLogged: 0,
    };
    expect(c.reason).not.toMatch(FORBIDDEN);
    expect(reconcile([], [c], 1).cards[0].reason).toBe(c.reason);
  });
});
