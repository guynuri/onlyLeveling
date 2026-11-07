// /api/ai/review (PLAN, SPEC Phase 2). One stored review per user per closed week. Generated once, through the same
// provider chain and daily cap as the first plan. When the AI does not answer, the app stores the rules text instead,
// so the week is settled and the AI is not asked again for it. Auth is checked by the router.
import type { Env } from '../env';
import type { Principal } from '../auth';
import { AI } from '../config';
import { corsHeaders } from '../cors';
import { readLimitedText, TooLargeError } from '../request';
import { runChain, workersAiProvider, type Provider } from '../ai/chain';
import { incrementUsage, record, sha256Hex } from './ai';
import { reviewPrompt, validateReviewText, REVIEW_LIMITS, type WeekFacts } from '../../../shared/ai-review';

const WEEK = /^\d{4}-\d{2}-\d{2}$/;
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const count = (v: unknown, max: number) => typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= max;

export function parseFacts(body: unknown): WeekFacts | null {
  if (!isObj(body) || !isObj(body.facts)) return null;
  const f = body.facts;
  if (typeof f.week !== 'string' || !WEEK.test(f.week)) return null;
  if (!count(f.sessionsDone, 100) || !count(f.sessionsPlanned, 100) || !count(f.streakWeeks, 500) || !count(f.openSwaps, 100)) return null;
  return {
    week: f.week,
    sessionsDone: f.sessionsDone as number,
    sessionsPlanned: f.sessionsPlanned as number,
    streakWeeks: f.streakWeeks as number,
    openSwaps: f.openSwaps as number,
  };
}

export interface ReviewDeps {
  providers: readonly Provider[];
  dailyCap: number;
  timeoutMs: number;
  now: number;
}

export type ReviewOutcome = { status: 'ai'; text: string; provider: string | null } | { status: 'fallback'; reason: string };

export async function getReview(db: D1Database, userId: string, week: string): Promise<{ text: string; provider: string | null } | null> {
  const row = await db
    .prepare('SELECT text, provider FROM weekly_reviews WHERE user_id = ? AND week = ?')
    .bind(userId, week)
    .first<{ text: string; provider: string | null }>();
  return row ?? null;
}

// Returns the stored review if there is one. Otherwise asks the chain, and stores the answer on success.
export async function generateReview(db: D1Database, userId: string, facts: WeekFacts, deps: ReviewDeps): Promise<ReviewOutcome> {
  const existing = await getReview(db, userId, facts.week);
  if (existing) return { status: 'ai', text: existing.text, provider: existing.provider };

  const day = new Date(deps.now).toISOString().slice(0, 10);
  const calls = await incrementUsage(db, userId, day);
  const prompt = reviewPrompt(facts);
  const hash = await sha256Hex(prompt);
  if (calls > deps.dailyCap) {
    await record(db, userId, hash, null, 'capped', deps.now);
    return { status: 'fallback', reason: 'capped' };
  }
  const out = await runChain(
    deps.providers,
    prompt,
    (raw) => {
      const r = validateReviewText(raw);
      return r.ok ? { ok: true, value: r.text } : { ok: false, errors: r.errors };
    },
    deps.timeoutMs,
  );
  if (out.status === 'ai') {
    await db
      .prepare('INSERT OR IGNORE INTO weekly_reviews (user_id, week, text, provider, created_at) VALUES (?, ?, ?, ?, ?)')
      .bind(userId, facts.week, out.value, out.provider, deps.now)
      .run();
    await record(db, userId, hash, out.provider, 'ai', deps.now);
    // Return what is stored, not what this call got: an overlapping request may have stored its own answer first.
    const stored = await getReview(db, userId, facts.week);
    return { status: 'ai', text: stored?.text ?? out.value, provider: stored?.provider ?? out.provider };
  }
  await record(db, userId, hash, null, 'fallback', deps.now);
  return { status: 'fallback', reason: out.reason };
}

// The rules text, stored when the AI did not answer. Keeps any review that is already stored.
export async function storeRulesReview(db: D1Database, userId: string, week: string, raw: string, now: number): Promise<{ text: string } | null> {
  const checked = validateReviewText(raw);
  if (!checked.ok) return null;
  await db
    .prepare('INSERT OR IGNORE INTO weekly_reviews (user_id, week, text, provider, created_at) VALUES (?, ?, ?, NULL, ?)')
    .bind(userId, week, checked.text, now)
    .run();
  const row = await getReview(db, userId, week);
  return row ? { text: row.text } : null;
}

export const reviewSlot = async (req: Request, env: Env, principal: Principal): Promise<Response | null> => {
  const url = new URL(req.url);
  if (!url.pathname.startsWith('/api/ai/review')) return null;
  const origin = req.headers.get('Origin');
  const send = (body: unknown, status: number) =>
    new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) } });
  const now = Date.now();

  if (url.pathname === '/api/ai/review' && req.method === 'GET') {
    const week = url.searchParams.get('week') ?? '';
    if (!WEEK.test(week)) return send({ error: 'bad week' }, 400);
    const row = await getReview(env.DB, principal.userId, week);
    return row ? send(row, 200) : send({ error: 'none' }, 404);
  }

  if (req.method !== 'POST') return send({ error: 'method not allowed' }, 405);
  let body: unknown;
  try {
    body = JSON.parse(await readLimitedText(req));
  } catch (e) {
    return send({ error: e instanceof TooLargeError ? 'body too large' : 'bad json' }, e instanceof TooLargeError ? 413 : 400);
  }

  if (url.pathname === '/api/ai/review') {
    const facts = parseFacts(body);
    if (!facts) return send({ error: 'bad request' }, 400);
    const out = await generateReview(env.DB, principal.userId, facts, {
      providers: [workersAiProvider(env.AI, AI.model, AI.maxTokens)],
      dailyCap: AI.dailyCap,
      timeoutMs: AI.timeoutMs,
      now,
    });
    return send(out, 200);
  }

  if (url.pathname === '/api/ai/review/rules') {
    if (!isObj(body) || typeof body.week !== 'string' || !WEEK.test(body.week) || typeof body.text !== 'string') {
      return send({ error: 'bad request' }, 400);
    }
    if (body.text.length > REVIEW_LIMITS.textMax * 2) return send({ error: 'text too long' }, 400);
    const stored = await storeRulesReview(env.DB, principal.userId, body.week, body.text, now);
    return stored ? send(stored, 200) : send({ error: 'plain text only' }, 400);
  }

  return send({ error: 'not found' }, 404);
};
