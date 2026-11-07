import { describe, it, expect, beforeEach } from 'vitest';
import { env } from 'cloudflare:test';
import { proposePlan, parsePlanRequest, type AiDeps } from './ai';
import type { Provider } from '../ai/chain';
import type { PlanRequest } from '../../../shared/ai-prompt';
import type { Env } from '../env';

const db = (env as unknown as Env).DB;
const U = 'u_ai';
const NOW = Date.UTC(2026, 10, 5, 12);

beforeEach(async () => {
  for (const t of ['ai_usage', 'plan_proposals']) await db.prepare(`DELETE FROM ${t}`).run();
});

// Two dumbbell exercises, a 2-day plan of one exercise each. The answer below asks for 9 kg (owned: 8 is the bell
// below) and 15 reps (range is 8 to 12): both corrected, not rejected.
const req: PlanRequest = {
  summary: { goal: 'build muscle', daysPerWeek: 2 },
  candidates: {
    fx_a: { name: 'Alpha Press', repMin: 8, repMax: 12 },
    fx_b: { name: 'Beta Row', repMin: 8, repMax: 12 },
  },
  daysPerWeek: 2,
  exercisesPerDay: 2,
  owned: [4, 6, 8, 10],
  avoid: [],
};
const answer = JSON.stringify({
  plan: {
    name: 'Starter',
    days: [
      { label: 'Day A', exercises: [{ exerciseId: 'fx_a', reason: 'Chest', w: 9, reps: 15, sets: 3 }] },
      { label: 'Day B', exercises: [{ exerciseId: 'fx_b', reason: 'Back', w: 8, reps: 10, sets: 3 }] },
    ],
  },
  note: 'Training guidance.',
});

const fake = (text: string, name = 'fake'): { provider: Provider; calls: () => number } => {
  let n = 0;
  return {
    provider: {
      name,
      complete: async () => {
        n++;
        return text;
      },
    },
    calls: () => n,
  };
};
const deps = (providers: Provider[], dailyCap = 5): AiDeps => ({ providers, dailyCap, timeoutMs: 1000, now: NOW });

describe('proposePlan', () => {
  it('a valid answer is returned with its corrections, and audited', async () => {
    const f = fake(answer, 'workers-ai');
    const out = await proposePlan(db, U, req, deps([f.provider]));
    expect(out.status).toBe('ai');
    if (out.status !== 'ai') return;
    expect(out.plan.days[0].exercises[0]).toMatchObject({ exerciseId: 'fx_a', w: 8, reps: 12, sets: 3 });
    expect(out.corrections.map((c) => c.path).sort()).toEqual(['days[0].exercises[0].reps', 'days[0].exercises[0].w'].sort());
    const row = await db.prepare('SELECT provider, status FROM plan_proposals WHERE user_id = ?').bind(U).first();
    expect(row).toEqual({ provider: 'workers-ai', status: 'ai' });
  });

  it('an invalid answer falls back, and the attempt is audited with no provider', async () => {
    const f = fake('{"plan": "nope"}');
    const out = await proposePlan(db, U, req, deps([f.provider]));
    expect(out).toEqual({ status: 'fallback', reason: 'invalid', detail: 'the answer broke a plan rule' });
    const row = await db.prepare('SELECT provider, status FROM plan_proposals WHERE user_id = ?').bind(U).first();
    expect(row).toEqual({ provider: null, status: 'fallback' });
  });

  it('over the daily cap: no provider is called, and the answer is capped', async () => {
    const f = fake(answer);
    await proposePlan(db, U, req, deps([f.provider], 1)); // call 1: within the cap
    const second = await proposePlan(db, U, req, deps([f.provider], 1)); // call 2: over
    expect(second).toEqual({ status: 'fallback', reason: 'capped' });
    expect(f.calls()).toBe(1);
  });

  it('the stored audit row keeps the prompt hash, not the prompt', async () => {
    await proposePlan(db, U, req, deps([fake(answer).provider]));
    const row = await db.prepare('SELECT prompt_hash FROM plan_proposals WHERE user_id = ?').bind(U).first<{ prompt_hash: string }>();
    expect(row?.prompt_hash).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe('parsePlanRequest (shape only)', () => {
  it('accepts the request the app sends', () => {
    expect(parsePlanRequest(req)).not.toBeNull();
  });
  it('keeps per-exercise loads: null for no weight, a list to snap to', () => {
    const body = { ...req, candidates: { a: { name: 'Push-up', repMin: 8, repMax: 12, loads: null }, b: { name: 'Swing', repMin: 8, repMax: 12, loads: [12, 16] } } };
    expect(parsePlanRequest(body)?.candidates).toEqual(body.candidates);
  });
  it('rejects loads that are not null or a list of positive numbers', () => {
    expect(parsePlanRequest({ ...req, candidates: { a: { name: 'x', repMin: 8, repMax: 12, loads: 'heavy' } } })).toBeNull();
    expect(parsePlanRequest({ ...req, candidates: { a: { name: 'x', repMin: 8, repMax: 12, loads: [0] } } })).toBeNull();
  });
  it('rejects a missing field, a bad day count, and an oversized candidate list', () => {
    expect(parsePlanRequest({ ...req, daysPerWeek: 0 })).toBeNull();
    expect(parsePlanRequest({ ...req, summary: undefined })).toBeNull();
    const many = Object.fromEntries(Array.from({ length: 401 }, (_, i) => [`fx_${i}`, { name: 'x', repMin: 8, repMax: 12 }]));
    expect(parsePlanRequest({ ...req, candidates: many })).toBeNull();
  });
});
