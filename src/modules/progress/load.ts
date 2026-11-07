// One read of everything Home and Progress show (UX design §6.2, §6.6). Computed from history; badges are recorded the
// first time they show and stay listed even if history is later edited.
import { getExercise } from '../../data/exercises';
import { sessionStarts } from '../../domain/block';
import type { Plan } from '../../domain/plan';
import type { BodyweightEntry, Settings, Workout } from '../../domain/types';
import { getLocalRepo, getRepo, defaultSettings, repRangeFor, currentPlan } from '../training/data';
import { computeProgress, type ProgressState } from '../xp/domain/progress';
import { GROUPS } from '../xp/domain/muscles';

export interface Loaded {
  settings: Settings;
  plan: Plan;
  workouts: Workout[];
  bodyweight: BodyweightEntry[];
  state: ProgressState;
  totalXp: number; // every muscle plus cardio: the player level reads this
  slotStarts: number[]; // finished sessions (lifting + planned cardio days), for the next-session pick
}

export async function loadProgress(now = Date.now()): Promise<Loaded> {
  const repo = await getRepo();
  const settings = (await repo.getSettings()) ?? defaultSettings();
  const workouts = await repo.listWorkouts();
  const bodyweight = await repo.listBodyweight();
  const cardio = await repo.listCardio();
  const plan = await currentPlan(repo, await getLocalRepo(), settings, now);
  const p = computeProgress({
    workouts,
    exerciseById: getExercise,
    bodyweight,
    cardio,
    // The week's target is the plan's sessions, cardio days included (UX design §6.5).
    daysPerWeek: plan.days.length > 0 ? plan.days.length : settings.daysPerWeek,
    repMaxFor: (id) => {
      const ex = getExercise(id);
      return ex ? repRangeFor(ex).max : 0;
    },
    now,
  });
  for (const key of p.badges) await repo.awardBadge(key, now);
  const stored = (await repo.listBadges()).map((b) => b.badgeKey);
  const state = { ...p, badges: [...new Set([...stored, ...p.badges])] };
  const totalXp = GROUPS.reduce((sum, g) => sum + p.muscles[g].xp, p.cardioXp);
  return { settings, plan, workouts, bodyweight, state, totalXp, slotStarts: sessionStarts(workouts, cardio) };
}
