import { describe, it, expect, beforeEach } from 'vitest';
import { env } from 'cloudflare:test';
import { generateReview, getReview, storeRulesReview, parseFacts, type ReviewDeps } from './review';
import type { Provider } from '../ai/chain';
import type { WeekFacts } from '../../../shared/ai-review';
import type { Env } from '../env';

const db = (env as unknown as Env).DB;
const U = 'u_review';
const NOW = Date.UTC(2026, 10, 9, 9);
const facts: WeekFacts = { week: '2026-11-02', sessionsDone: 2, sessionsPlanned: 3, streakWeeks: 4, openSwaps: 1 };

beforeEach(async () => {
  for (const t of ['weekly_reviews', 'ai_usage', 'plan_proposals']) await db.prepare(`DELETE FROM ${t}`).run();
});

const fake = (text: string, name = 'workers-ai') => {
  let n = 0;
  const provider: Provider = {
    name,
    complete: async () => {
      n++;
      return text;
    },
  };
  return { provider, calls: () => n };
};
const deps = (providers: Provider[], dailyCap = 5): ReviewDeps => ({ providers, dailyCap, timeoutMs: 1000, now: NOW });

describe('generateReview', () => {
  it('a plain-text answer is stored, and the next call returns it without asking again', async () => {
    const f = fake('Two of three sessions done. Keep the streak going.');
    const first = await generateReview(db, U, facts, deps([f.provider]));
    expect(first).toEqual({ status: 'ai', text: 'Two of three sessions done. Keep the streak going.', provider: 'workers-ai' });
    const second = await generateReview(db, U, facts, deps([f.provider]));
    expect(second.status).toBe('ai');
    expect(f.calls()).toBe(1);
  });

  it('two overlapping requests for one week: both callers get the text that was stored first', async () => {
    const racing: Provider = {
      name: 'workers-ai',
      complete: async () => {
        // Another request stores its answer while this one is waiting on the provider.
        await db
          .prepare('INSERT INTO weekly_reviews (user_id, week, text, provider, created_at) VALUES (?, ?, ?, ?, ?)')
          .bind(U, facts.week, 'Stored first.', 'workers-ai', NOW)
          .run();
        return 'Second answer.';
      },
    };
    const out = await generateReview(db, U, facts, deps([racing]));
    expect(out).toEqual({ status: 'ai', text: 'Stored first.', provider: 'workers-ai' });
    expect(await getReview(db, U, facts.week)).toEqual({ text: 'Stored first.', provider: 'workers-ai' });
  });

  it('markup in the answer is rejected: nothing is stored, and the outcome is a fallback', async () => {
    const f = fake('<b>Great week</b>');
    const out = await generateReview(db, U, facts, deps([f.provider]));
    expect(out).toEqual({ status: 'fallback', reason: 'invalid' });
    expect(await getReview(db, U, facts.week)).toBeNull();
  });

  it('over the daily cap: no provider is called', async () => {
    const f = fake('Fine week.');
    const out = await generateReview(db, U, facts, deps([f.provider], 0));
    expect(out).toEqual({ status: 'fallback', reason: 'capped' });
    expect(f.calls()).toBe(0);
  });
});

describe('the rules text', () => {
  it('is stored when the AI did not answer, and a stored review is never replaced', async () => {
    const first = await storeRulesReview(db, U, facts.week, 'You finished 2 of 3 planned sessions.', NOW);
    expect(first).toEqual({ text: 'You finished 2 of 3 planned sessions.' });
    const second = await storeRulesReview(db, U, facts.week, 'A different text.', NOW);
    expect(second).toEqual({ text: 'You finished 2 of 3 planned sessions.' });
  });

  it('refuses text with markup', async () => {
    expect(await storeRulesReview(db, U, facts.week, '<i>x</i>', NOW)).toBeNull();
  });
});

describe('parseFacts', () => {
  it('accepts the facts the app sends and rejects a bad week or a negative count', () => {
    expect(parseFacts({ facts })).toEqual(facts);
    expect(parseFacts({ facts: { ...facts, week: '2 Nov' } })).toBeNull();
    expect(parseFacts({ facts: { ...facts, sessionsDone: -1 } })).toBeNull();
    expect(parseFacts({ facts: { ...facts, streakWeeks: 1.5 } })).toBeNull();
  });
});
