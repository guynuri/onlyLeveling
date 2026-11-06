// App glue for the coach: load the cards, and apply the user's choice. Rules are in domain/; this only wires them.
import { listExercises, getExercise } from '../../data/exercises';
import { applySuggestion, planExerciseIds } from '../../domain/plan';
import { notNowUntil, candidates, reconcile } from './domain/suggest';
import type { Suggestion } from '../../domain/suggestion';
import { blockedIds, equipmentOf } from '../../domain/profile';
import { getRepo, getLocalRepo, defaultSettings, currentPlan, repRangeFor } from '../training/data';

// Cards to show now. Saves any new or changed suggestion records, so they sync like other data.
export async function loadCoachCards(now = Date.now()): Promise<Suggestion[]> {
  const repo = await getRepo();
  const s = (await repo.getSettings()) ?? defaultSettings();
  const plan = await currentPlan(repo, await getLocalRepo(), s, now);
  const workouts = await repo.listWorkouts();
  const stored = await repo.listSuggestions();
  const catalogue = listExercises();
  const cands = candidates({
    now,
    plan,
    owned: s.owned,
    equipment: equipmentOf(s),
    catalogue,
    workouts,
    stored,
    blocked: blockedIds(s, catalogue),
    repMaxFor: (id) => {
      const ex = getExercise(id);
      return ex ? repRangeFor(ex).max : 0;
    },
  });
  const { cards, save } = reconcile(stored, cands, now);
  for (const c of save) await repo.saveSuggestion(c);
  return cards;
}

// Returns false when the plan no longer has the exercise (it changed since the card was shown): nothing is saved.
export async function acceptCoachCard(s: Suggestion, now = Date.now()): Promise<boolean> {
  const repo = await getRepo();
  const settings = (await repo.getSettings()) ?? defaultSettings();
  const plan = await currentPlan(repo, await getLocalRepo(), settings, now);
  if (!planExerciseIds(plan).includes(s.exerciseId)) return false;
  await repo.savePlan(applySuggestion(plan, s, now, settings.owned));
  // deloadTried outlives later saves of this card: the next stall offers a swap, not another deload.
  const deloadTried = s.deloadTried === true || s.action.kind === 'deload';
  await repo.saveSuggestion({ ...s, status: 'accepted', createdAt: now, deloadTried });
  return true;
}

export async function snoozeCoachCard(s: Suggestion, now = Date.now()): Promise<void> {
  const repo = await getRepo();
  await repo.saveSuggestion({ ...s, status: 'snoozed', until: notNowUntil(now) });
}

export async function neverCoachCard(s: Suggestion): Promise<void> {
  const repo = await getRepo();
  await repo.saveSuggestion({ ...s, status: 'never' });
}
