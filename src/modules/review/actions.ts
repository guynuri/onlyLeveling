// App glue for the weekly review (PLAN, SPEC Phase 2). Reads the stored review, asks the Worker once per week, and stores
// the rules text when the AI does not answer. Without a server it shows the rules text and stores nothing.
import { readSyncState } from '../sync/actions';
import { getRepo, defaultSettings } from '../training/data';
import { getExercise } from '../../data/exercises';
import { repRangeFor } from '../../domain/reps';
import { computeProgress } from '../xp/domain/progress';
import { rulesReviewText, type WeekFacts } from '../../../shared/ai-review';
import { lastClosedWeekStart, buildFacts, shouldStoreRules } from './domain/review';

export interface ReviewView {
  week: string;
  text: string;
  label: 'ai' | 'rules'; // 'rules' shows "Built by rules; AI unavailable."
}

async function api(method: 'GET' | 'POST', path: string, body?: unknown): Promise<{ status: number; json: unknown }> {
  const cfg = (await readSyncState()).config;
  if (!cfg) throw new Error('signed-out');
  const res = await fetch(`${cfg.baseUrl}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cfg.token}` },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: res.status, json: await res.json().catch(() => null) };
}

export async function loadWeeklyReview(now: Date = new Date()): Promise<ReviewView | null> {
  const repo = await getRepo();
  const s = (await repo.getSettings()) ?? defaultSettings();
  const workouts = await repo.listWorkouts();
  if (workouts.length === 0) return null; // nothing to review yet
  const week = lastClosedWeekStart(now);
  const progress = computeProgress({
    workouts,
    exerciseById: getExercise,
    bodyweight: await repo.listBodyweight(),
    daysPerWeek: s.daysPerWeek,
    repMaxFor: (id) => {
      const ex = getExercise(id);
      return ex ? repRangeFor(ex).max : 0;
    },
    now: now.getTime(),
  });
  const pending = (await repo.listSuggestions()).filter((x) => x.status === 'pending').length;
  const facts: WeekFacts = buildFacts({
    week,
    workouts,
    daysPerWeek: s.daysPerWeek,
    streakWeeks: progress.streak,
    pendingSuggestions: pending,
  });
  const rules: ReviewView = { week, text: rulesReviewText(facts), label: 'rules' };
  try {
    const stored = await api('GET', `/api/ai/review?week=${week}`);
    if (stored.status === 200) {
      const row = stored.json as { text: string; provider: string | null };
      return { week, text: row.text, label: row.provider ? 'ai' : 'rules' };
    }
    const asked = await api('POST', '/api/ai/review', { facts });
    const out = asked.json as { status: string; text?: string; reason?: string };
    if (out.status === 'ai' && out.text) {
      return { week, text: out.text, label: 'ai' };
    }
    // The AI failed: store the rules text so this week is settled and not asked again. A spent quota stores nothing,
    // so a later open can still ask the AI for this week.
    if (shouldStoreRules(out.reason ?? '')) await api('POST', '/api/ai/review/rules', { week, text: rules.text });
    return rules;
  } catch {
    // Not signed in, or the Worker is unreachable: show the rules text, store nothing.
    return rules;
  }
}
