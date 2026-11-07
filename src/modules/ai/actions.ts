// App glue for the first-plan proposal (PLAN Phase 7). Pure rules live in domain/; this only calls the Worker and saves
// the plan the user picked. Nothing is saved until the user chooses.
import { listExercises } from '../../data/exercises';
import { readSyncState } from '../sync/actions';
import type { Plan } from '../../domain/plan';
import type { Settings } from '../../domain/types';
import { TEMPLATE } from '../../config/thresholds';
import type { Correction, ValidPlan } from '../../../shared/ai-plan';
import { buildPlanRequest } from './domain/request';
import { getRepo, defaultSettings } from '../training/data';
import { readRanks } from '../progress/ranks-cache';
import { AI_REQUEST } from '../../config/thresholds';


export type Proposal =
  | { status: 'ai'; provider: string; plan: ValidPlan; corrections: Correction[] }
  | { status: 'fallback'; reason: string; detail?: string };

// The newest bodyweight entry, for the AI summary. A read failure just leaves it out.
export async function latestBodyweightKg(): Promise<number | null> {
  try {
    return (await (await getRepo()).listBodyweight())[0]?.kg ?? null;
  } catch {
    return null;
  }
}

// The Worker's answer, or a fallback reason. Offline, signed out, and over the daily cap all fall back to the rules.
export async function requestProposal(s: Settings, fetchImpl: typeof fetch = fetch, supersets = false, supersetSize?: 2 | 3): Promise<Proposal> {
  const cfg = (await readSyncState()).config;
  if (!cfg) return { status: 'fallback', reason: 'signed-out' };
  const latest = await latestBodyweightKg();
  let res: Response;
  try {
    res = await fetchImpl(`${cfg.baseUrl}/api/ai/plan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cfg.token}` },
      // The Worker gives up after two tries of AI.timeoutMs; past that the rules plan stands in.
      signal: AbortSignal.timeout(AI_REQUEST.clientTimeoutMs),
      body: JSON.stringify(buildPlanRequest(s, listExercises(), TEMPLATE.exercisesPerDay, latest, supersets, readRanks(), supersetSize)),
    });
  } catch {
    return { status: 'fallback', reason: 'unreachable', detail: 'no answer in time' };
  }
  if (!res.ok) return { status: 'fallback', reason: res.status === 401 ? 'signed-out' : 'unreachable', detail: `server answered ${res.status}` };
  const data = (await res.json()) as { status: string; reason?: string; detail?: string; provider?: string; plan?: ValidPlan; corrections?: Correction[] };
  if (data.status === 'ai' && data.plan) {
    return { status: 'ai', provider: data.provider ?? 'unknown', plan: data.plan, corrections: data.corrections ?? [] };
  }
  return { status: 'fallback', reason: data.reason ?? 'unreachable', ...(typeof data.detail === 'string' ? { detail: data.detail.slice(0, 120) } : {}) };
}

export async function saveChosenPlan(plan: Plan): Promise<void> {
  const repo = await getRepo();
  await repo.savePlan(plan);
}

export async function savedSettings(): Promise<Settings> {
  const repo = await getRepo();
  return (await repo.getSettings()) ?? defaultSettings();
}
