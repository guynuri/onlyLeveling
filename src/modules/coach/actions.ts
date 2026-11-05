// App glue for the coach: load the cards, and apply the user's choice. Rules are in domain/; this only wires them.
import { listExercises, getExercise } from '../../data/exercises';
import { applySuggestion, planExerciseIds } from '../../domain/plan';
import { notNowUntil, candidates, reconcile } from './domain/suggest';
import type { Suggestion } from '../../domain/suggestion';
import { getRepo, defaultSettings, currentPlan, repRangeFor } from '../training/data';

// Cards to show now. Saves any new or changed suggestion records, so they sync like other data.
export async function loadCoachCards(now = Date.now()): Promise<Suggestion[]> {
  const repo = await getRepo();
  const s = (await repo.getSettings()) ?? defaultSettings();
  const plan = await currentPlan(repo, s, now);
  const workouts = await repo.listWorkouts();
  const stored = await repo.listSuggestions();
  const catalogue = listExercises();
  const cands = candidates({
    now,
    plan,
    owned: s.owned,
    catalogue,
    workouts,
    stored,
    repMaxFor: (id) => {
      const ex = getExercise(id);
      return ex ? repRangeFor(ex).max : 0;
    },
  });
  const { cards, save } = reconcile(stored, cands, now);
  for (const c of save) await repo.saveSuggestion(c);
  return cards;
}

export async function acceptCoachCard(s: Suggestion, now = Date.now()): Promise<void> {
  const repo = await getRepo();
  const settings = (await repo.getSettings()) ?? defaultSettings();
  const plan = await currentPlan(repo, settings, now);
  if (!planExerciseIds(plan).includes(s.exerciseId)) return; // the plan changed since the card was shown
  await repo.savePlan(applySuggestion(plan, s, now, settings.owned));
  await repo.saveSuggestion({ ...s, status: 'accepted', createdAt: now });
}

export async function snoozeCoachCard(s: Suggestion, now = Date.now()): Promise<void> {
  const repo = await getRepo();
  await repo.saveSuggestion({ ...s, status: 'snoozed', until: notNowUntil(now) });
}

export async function neverCoachCard(s: Suggestion): Promise<void> {
  const repo = await getRepo();
  await repo.saveSuggestion({ ...s, status: 'never' });
}
