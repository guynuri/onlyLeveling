// POST /api/ai/plan (SPEC §5, PLAN Phase 7). Auth is checked by the router. This handler: shape check, daily cap,
// provider chain with validation, audit row. The response is either a validated plan with its corrections, or a
// fallback reason. The app then builds the rules plan itself.
import type { Env } from '../env';
import type { Principal } from '../auth';
import type { SlotHandler } from './index';
import { AI } from '../config';
import { corsHeaders } from '../cors';
import { readLimitedText, TooLargeError } from '../request';
import { validateAiPlan, type Candidate, type Correction, type PlanInput, type ValidPlan } from '../../../shared/ai-plan';
import { buildPrompt, type PlanRequest } from '../../../shared/ai-prompt';
import { runChain, workersAiProvider, type Provider } from '../ai/chain';

const MAX_CANDIDATES = 400;

export interface AiDeps {
  providers: readonly Provider[];
  dailyCap: number;
  timeoutMs: number;
  now: number;
}

export type ProposeResult =
  | { status: 'ai'; provider: string; plan: ValidPlan; corrections: Correction[] }
  | { status: 'fallback'; reason: 'invalid' | 'unreachable' | 'none' | 'capped'; detail?: string };

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const MAX_ROUTINE = 150;
const FOCUS_GROUP = /^(chest|back|shoulders|biceps|triceps|quads|hamstrings|glutes|calves|core)$/;
const ROUTINE_ID = /^(fx|rp|og)_[A-Za-z0-9_.()'-]{1,90}$/;
const intIn = (v: unknown, lo: number, hi: number) => typeof v === 'number' && Number.isInteger(v) && v >= lo && v <= hi;

// Shape only: the validator checks the content of the AI's answer, not this request.
export function parsePlanRequest(body: unknown): PlanRequest | null {
  if (!isObj(body) || !isObj(body.summary) || !isObj(body.candidates)) return null;
  if (!intIn(body.daysPerWeek, 1, 7) || !intIn(body.exercisesPerDay, 1, 10)) return null;
  if (!Array.isArray(body.owned) || !body.owned.every((n) => typeof n === 'number' && n > 0)) return null;
  if (!Array.isArray(body.avoid) || !body.avoid.every((s) => typeof s === 'string')) return null;
  const entries = Object.entries(body.candidates);
  if (entries.length === 0 || entries.length > MAX_CANDIDATES) return null;
  const candidates: Record<string, Candidate> = {};
  for (const [id, c] of entries) {
    if (!isObj(c) || typeof c.name !== 'string' || c.name.length > 100 || !intIn(c.repMin, 1, 50) || !intIn(c.repMax, 1, 50)) return null;
    // `loads` is optional (older apps omit it): null = no weight, a list = snap to it.
    let loads: Candidate['loads'];
    if (c.loads === null) loads = null;
    else if (Array.isArray(c.loads) && c.loads.length <= 100 && c.loads.every((n) => typeof n === 'number' && n > 0)) loads = c.loads as number[];
    else if (c.loads !== undefined) return null;
    candidates[id] = { name: c.name, repMin: c.repMin as number, repMax: c.repMax as number, ...(loads === undefined ? {} : { loads }) };
  }
  // Optional warm-up and cool-down choices: id → short name, bounded.
  let routine: Record<string, string> | undefined;
  if (body.routine !== undefined) {
    if (!isObj(body.routine)) return null;
    const rs = Object.entries(body.routine);
    if (rs.length > MAX_ROUTINE) return null;
    // Library-shaped ids and short names only; anything else is dropped, so client text cannot pad the prompt.
    routine = Object.fromEntries(rs.filter(([id, n]) => ROUTINE_ID.test(id) && typeof n === 'string' && n.length <= 60 && !/[\r\n]/.test(n))) as Record<string, string>;
  }
  // Focus muscles reach the prompt: only known group names, at most 5.
  const summary = { ...body.summary };
  if ('focus' in summary) summary.focus = Array.isArray(summary.focus) ? summary.focus.filter((g) => typeof g === 'string' && FOCUS_GROUP.test(g)).slice(0, 5) : [];
  return {
    summary,
    candidates,
    daysPerWeek: body.daysPerWeek as number,
    exercisesPerDay: body.exercisesPerDay as number,
    owned: body.owned as number[],
    avoid: body.avoid as string[],
    supersets: body.supersets === true,
    ...(body.supersetSize === 2 || body.supersetSize === 3 ? { supersetSize: body.supersetSize } : {}),
    ...(routine ? { routine } : {}),
  };
}

export async function proposePlan(db: D1Database, userId: string, req: PlanRequest, deps: AiDeps): Promise<ProposeResult> {
  const day = new Date(deps.now).toISOString().slice(0, 10);
  const calls = await incrementUsage(db, userId, day);
  const prompt = buildPrompt(req);
  const hash = await sha256Hex(prompt);
  if (calls > deps.dailyCap) {
    await record(db, userId, hash, null, 'capped', deps.now);
    return { status: 'fallback', reason: 'capped' };
  }
  const input: PlanInput = {
    daysPerWeek: req.daysPerWeek,
    exercisesPerDay: req.exercisesPerDay,
    owned: req.owned,
    avoid: req.avoid,
    candidates: req.candidates,
    supersets: req.supersets === true,
    ...(req.supersetSize ? { supersetSize: req.supersetSize } : {}),
    ...(req.routine ? { routine: req.routine } : {}),
  };
  const out = await runChain(
    deps.providers,
    prompt,
    (raw) => {
      const r = validateAiPlan(raw, input);
      return r.ok ? { ok: true, value: { plan: r.plan, corrections: r.corrections } } : { ok: false, errors: r.errors };
    },
    deps.timeoutMs,
  );
  if (out.status === 'ai') {
    await record(db, userId, hash, out.provider, 'ai', deps.now);
    return { status: 'ai', provider: out.provider, plan: out.value.plan, corrections: out.value.corrections };
  }
  await record(db, userId, hash, null, 'fallback', deps.now);
  return { status: 'fallback', reason: out.reason, ...(out.detail ? { detail: out.detail } : {}) };
}

// Counts this call for the day and returns the new total.
export async function incrementUsage(db: D1Database, userId: string, day: string): Promise<number> {
  const row = await db
    .prepare(
      `INSERT INTO ai_usage (user_id, day, calls) VALUES (?, ?, 1)
       ON CONFLICT (user_id, day) DO UPDATE SET calls = calls + 1
       RETURNING calls`,
    )
    .bind(userId, day)
    .first<{ calls: number }>();
  return row?.calls ?? 0;
}

export async function record(
  db: D1Database,
  userId: string,
  hash: string,
  provider: string | null,
  status: string,
  now: number,
): Promise<void> {
  await db
    .prepare('INSERT INTO plan_proposals (id, user_id, prompt_hash, provider, status, created_at) VALUES (?, ?, ?, ?, ?, ?)')
    .bind(crypto.randomUUID(), userId, hash, provider, status, now)
    .run();
}

export async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

// The router's slot for /api/ai/* (PLAN contracts freeze). Anything else under /api/ai/ is a 404.
export const aiSlot: SlotHandler = async (req: Request, env: Env, principal: Principal) => {
  const url = new URL(req.url);
  if (!url.pathname.startsWith('/api/ai/')) return null;
  const origin = req.headers.get('Origin');
  const send = (body: unknown, status: number) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
    });
  // Other /api/ai paths belong to other slots (the weekly review); the router answers 404 for any left over.
  if (url.pathname !== '/api/ai/plan') return null;
  if (req.method !== 'POST') return send({ error: 'method not allowed' }, 405);

  let body: unknown;
  try {
    body = JSON.parse(await readLimitedText(req));
  } catch (e) {
    return send({ error: e instanceof TooLargeError ? 'body too large' : 'bad json' }, e instanceof TooLargeError ? 413 : 400);
  }
  const parsed = parsePlanRequest(body);
  if (!parsed) return send({ error: 'bad request' }, 400);

  const providers = AI.models.map((m) => workersAiProvider(env.AI, m, AI.maxTokens));
  const result = await proposePlan(env.DB, principal.userId, parsed, {
    providers,
    dailyCap: AI.dailyCap,
    timeoutMs: AI.timeoutMs,
    now: Date.now(),
  });
  return send(result, 200);
};
