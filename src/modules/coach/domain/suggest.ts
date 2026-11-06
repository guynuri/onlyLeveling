// Turns the rules into suggestion cards (SPEC §4). Pure. `candidates` says what fires now; `reconcile` merges that
// with what the user already decided (Accept, Not now, Never) so a card does not come back against their choice.
import { COACH } from '../../../config/thresholds';
import { ownedUp } from '../../../domain/dumbbells';
import type { Exercise } from '../../../domain/exercise';
import { deloadWeight, planExerciseIds, type Plan } from '../../../domain/plan';
import { suggestionId, type Suggestion, type SuggestionAction, type SuggestionRule } from '../../../domain/suggestion';
import type { EquipmentChoice, Workout } from '../../../domain/types';
import { pickSwap } from './swap';
import { detectStale, detectStall, detectTooEasy, historyOf, missedSessions } from './rules';

const DAY = 86_400_000;

export interface Candidate {
  rule: SuggestionRule;
  exerciseId: string;
  reason: string;
  action: SuggestionAction;
  lastLogged: number; // epoch ms of the exercise's last session
}

export interface CoachInput {
  now: number;
  plan: Plan;
  owned: readonly number[];
  equipment: readonly EquipmentChoice[];
  catalogue: readonly Exercise[];
  workouts: readonly Workout[];
  stored: readonly Suggestion[];
  blocked?: ReadonlySet<string>; // avoid list + limits (domain/profile.ts blockedIds): never a swap target
  repMaxFor: (exerciseId: string) => number;
}

const kg = (v: number) => `${Math.round(v * 10) / 10} kg`;

export function candidates(input: CoachInput): Candidate[] {
  const { now, plan, owned, workouts, stored } = input;
  const byId = new Map(input.catalogue.map((e) => [e.id, e]));
  const inPlan = new Set(planExerciseIds(plan));
  const lastUsed = new Map<string, number>();
  for (const w of workouts) {
    for (const e of w.entries) lastUsed.set(e.exerciseId, Math.max(lastUsed.get(e.exerciseId) ?? 0, w.start));
  }
  const factor = Math.min(COACH.deloadMaxFactor, Math.max(COACH.deloadMinFactor, COACH.deloadFactor));
  const out: Candidate[] = [];

  for (const exerciseId of inPlan) {
    const ex = byId.get(exerciseId);
    if (!ex) continue;
    const hist = historyOf(workouts, exerciseId);
    // A limit (or the avoid list) added after the plan was made: the plan is never edited by itself, so the exercise
    // stays and a card offers a swap. It needs no history, so it comes before the history checks.
    if (input.blocked?.has(exerciseId)) {
      const to = pickSwap({ exercise: ex, catalogue: input.catalogue, inPlan, avoid: input.blocked, equipment: input.equipment, lastUsed, now });
      if (to) {
        out.push({
          rule: 'limit',
          exerciseId,
          reason: `${ex.name}: you listed a limit or avoid this exercise, and it is still in your plan. A swap with the same muscle is suggested. Training guidance, not medical advice.`,
          action: { kind: 'swap', toId: to.id },
          lastLogged: hist.length > 0 ? hist[hist.length - 1].date : 0,
        });
      }
    }
    if (hist.length === 0) continue;
    const last = hist[hist.length - 1];
    const lastW = last.target.w;
    const name = ex.name;
    const base = { exerciseId, lastLogged: last.date };
    const swapTo = () =>
      pickSwap({ exercise: ex, catalogue: input.catalogue, inPlan, avoid: input.blocked ?? new Set(), equipment: input.equipment, lastUsed, now });
    const deload: SuggestionAction = { kind: 'deload', w: deloadWeight(lastW, owned, factor) };

    const stall = detectStall(hist, now);
    if (stall) {
      // Deload first; once a deload was accepted for this exercise, the next stall offers a swap.
      const deloadTried = stored.some((s) => s.id === suggestionId('stall', exerciseId) && s.deloadTried === true);
      const swap = deloadTried ? swapTo() : null;
      out.push({
        ...base,
        rule: 'stall',
        reason: `${name}: your estimated best has not gone up in ${COACH.stallWeeks * 7} days (${kg(stall.bestRecent)} then, ${kg(stall.bestBefore)} before). Based on your last ${hist.length} sessions.`,
        action: swap ? { kind: 'swap', toId: swap.id } : deload,
      });
    }

    if (detectTooEasy(hist, input.repMaxFor(exerciseId))) {
      const up = ownedUp(owned, lastW, 2);
      if (up !== null) {
        out.push({
          ...base,
          rule: 'tooEasy',
          reason: `${name}: at the top of the range you had 3 or more reps left in each set, for ${COACH.tooEasySessions} sessions in a row.`,
          action: { kind: 'jump', w: up },
        });
      }
    }

    if (detectStale(hist, now)) {
      const swap = swapTo();
      if (swap) {
        out.push({
          ...base,
          rule: 'stale',
          reason: `${name}: you have done this for ${COACH.staleWeeks} weeks. A variation with the same muscle may help.`,
          action: { kind: 'swap', toId: swap.id },
        });
      }
    }

    const missed = missedSessions(hist, plan.updatedAt, plan.daysPerWeek, now);
    if (missed >= COACH.missedSessionsForDeload) {
      out.push({
        ...base,
        rule: 'missed',
        reason: `${name}: about ${missed} planned sessions have passed without it. A lighter week can help you come back.`,
        action: deload,
      });
    }
  }
  return out;
}

// Merge candidates with stored decisions. Returns the cards to show and the records to save (only changed ones).
// Never hides a card for good; Not now hides it until `until`; Accept hides it until a session after the accept.
export function reconcile(
  stored: readonly Suggestion[],
  cands: readonly Candidate[],
  now: number,
): { cards: Suggestion[]; save: Suggestion[] } {
  const byId = new Map(stored.map((s) => [s.id, s]));
  const cards: Suggestion[] = [];
  const save: Suggestion[] = [];
  for (const c of cands) {
    const id = suggestionId(c.rule, c.exerciseId);
    const rec = byId.get(id);
    if (rec?.status === 'never') continue;
    if (rec?.status === 'snoozed' && rec.until !== undefined && now < rec.until) continue;
    if (rec?.status === 'accepted' && c.lastLogged <= rec.createdAt) continue;
    const keepTime = rec?.status === 'pending' && rec.reason === c.reason;
    const next: Suggestion = {
      id,
      rule: c.rule,
      exerciseId: c.exerciseId,
      reason: c.reason,
      action: c.action,
      createdAt: keepTime ? rec.createdAt : now,
      status: 'pending',
      ...(rec?.deloadTried ? { deloadTried: true } : {}),
    };
    cards.push(next);
    if (!rec || JSON.stringify(rec) !== JSON.stringify(next)) save.push(next);
  }
  return { cards, save };
}

export function notNowUntil(now: number): number {
  return now + COACH.notNowDays * DAY;
}
