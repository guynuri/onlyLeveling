// One read of everything Home and Progress show (UX design §6.2, §6.6, §6.7). Computed from history; badges are
// recorded the first time they show and stay listed even if history is later edited. A week's quests are stored the
// first time the week is opened, so editing the plan mid-week does not change them.
import { getExercise } from '../../data/exercises';
import { sessionStarts } from '../../domain/block';
import type { Plan } from '../../domain/plan';
import { goalsOf } from '../../domain/profile';
import type { BodyweightEntry, Settings, Workout } from '../../domain/types';
import { GAME } from '../../config/thresholds';
import type { Repo } from '../../data/repo';
import { readSyncState } from '../sync/actions';
import { getLocalRepo, getRepo, defaultSettings, repRangeFor, currentPlan } from '../training/data';
import { computeProgress, type ProgressInput, type ProgressState } from '../xp/domain/progress';
import { GROUPS, groupOf, type Group } from '../xp/domain/muscles';
import { generateQuests, monthBounds, monthKey, monthlyRecap, questHave, weekKey, type MonthlyRecap, type Quest } from '../xp/domain/game';

export interface Loaded {
  settings: Settings;
  plan: Plan;
  workouts: Workout[];
  bodyweight: BodyweightEntry[];
  state: ProgressState;
  totalXp: number; // every muscle, cardio and quest bonus: the player level reads this
  slotStarts: number[]; // finished sessions (lifting + planned cardio days), for the next-session pick
  quests: { quest: Quest; have: number }[]; // this week
  recap: { key: string; month: number; recap: MonthlyRecap } | null; // last month, until dismissed
}

const isQuests = (d: unknown): d is Quest[] =>
  Array.isArray(d) && d.every((q) => typeof q === 'object' && q !== null && typeof q.kind === 'string' && typeof q.need === 'number');

// Local noon of a YYYY-MM-DD key (inside that day whatever the DST shift).
const dayOf = (key: string) => {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d, 12).getTime();
};

// When this app copy started. Quests are stored only after a pull that finished since then (or with no account), so a
// device that is behind cannot store a week's quests from partial history and win the server's first write.
const OPENED_AT = Date.now();
async function syncedThisOpen(): Promise<boolean> {
  const s = await readSyncState().catch(() => null);
  return !!s && (!s.config || (s.lastSyncedAt !== null && s.lastSyncedAt >= OPENED_AT));
}

export async function loadProgress(now = Date.now()): Promise<Loaded> {
  const repo = await getRepo();
  const settings = (await repo.getSettings()) ?? defaultSettings();
  const workouts = await repo.listWorkouts();
  const bodyweight = await repo.listBodyweight();
  const cardio = await repo.listCardio();
  const plan = await currentPlan(repo, await getLocalRepo(), settings, now);
  const input: ProgressInput = {
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
  };
  const p = computeProgress(input);
  for (const key of p.badges) await repo.awardBadge(key, now);
  const stored = (await repo.listBadges()).map((b) => b.badgeKey);
  const state = { ...p, badges: [...new Set([...stored, ...p.badges])] };
  const slotStarts = sessionStarts(workouts, cardio);

  // Not synced yet this open: show this week's quests without storing them (no bonus until they are stored).
  const draft = await ensureQuests(repo, plan, settings, workouts, input.daysPerWeek, now, await syncedThisOpen());
  const records = await repo.listGame();
  const history = { workouts, cardio, slotStarts, exerciseById: getExercise };
  let bonusXp = 0;
  let quests: Loaded['quests'] = [];
  for (const r of records) {
    if (!r.key.startsWith('quests:') || !isQuests(r.data)) continue;
    const weekOf = dayOf(r.key.slice('quests:'.length));
    const rows = r.data.map((quest) => ({ quest, have: questHave(quest, { ...history, weekOf }) }));
    bonusXp += rows.filter((x) => x.have >= x.quest.need).length * GAME.questBonusXp;
    if (r.key === `quests:${weekKey(now)}`) quests = rows;
  }
  if (quests.length === 0 && draft) quests = draft.map((quest) => ({ quest, have: questHave(quest, { ...history, weekOf: now }) }));

  // Last month's recap shows from the first open of a new month until dismissed, if anything happened in it.
  const last = monthBounds(now).from - 1;
  const key = `recap:${monthKey(last)}`;
  const { from } = monthBounds(last);
  const active = slotStarts.some((t) => t >= from && t <= last) || cardio.some((c) => c.start >= from && c.start <= last);
  const recap = active && !records.some((r) => r.key === key) ? { key, month: last, recap: monthlyRecap(input, last) } : null;

  const totalXp = GROUPS.reduce((sum, g) => sum + p.muscles[g].xp, p.cardioXp + bonusXp);
  return { settings, plan, workouts, bodyweight, state, totalXp, slotStarts, quests, recap };
}

// Returns the generated quests when they were not stored (not synced yet), else null.
async function ensureQuests(repo: Repo, plan: Plan, settings: Settings, workouts: Workout[], daysPerWeek: number, now: number, store: boolean): Promise<Quest[] | null> {
  const key = `quests:${weekKey(now)}`;
  if ((await repo.listGame()).some((r) => r.key === key)) return null;
  const planGroups = new Set<Group>();
  for (const d of plan.days) {
    for (const id of d.exerciseIds) for (const m of getExercise(id)?.primaryMuscles ?? []) {
      const g = groupOf(m);
      if (g) planGroups.add(g);
    }
  }
  const goals = goalsOf(settings);
  const wantsCardio =
    plan.days.some((d) => d.kind === 'cardio' || (d.postCardioMinutes ?? 0) > 0) || goals.includes('lose-fat') || goals.includes('endurance');
  const quests = generateQuests({ daysPerWeek, planGroups: [...planGroups], wantsCardio, workouts, exerciseById: getExercise, now });
  if (!store) return quests;
  await repo.putGame({ key, data: quests, at: now });
  return null;
}

export async function dismissRecap(key: string): Promise<void> {
  await (await getRepo()).putGame({ key, data: null, at: Date.now() });
}
