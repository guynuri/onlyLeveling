// Game layer (UX design §6.7, U7): streak freezes, weekly quests, monthly recap. Pure and deterministic: the clock
// and all history are passed in. Weeks run Monday to Sunday in local time (streak.ts weekStart).
import { GAME } from '../../../config/thresholds';
import type { CardioSession } from '../../../domain/cardio';
import type { Exercise } from '../../../domain/exercise';
import type { Workout } from '../../../domain/types';
import { GROUPS, groupOf, type Group } from './muscles';
import { computeProgress, type ProgressInput } from './progress';
import { RANKS, type Rank } from './rank';
import { nextWeek, weekStart } from './streak';

const DAY = 86_400_000;
type ById = (id: string) => Pick<Exercise, 'primaryMuscles' | 'mode'> | undefined;

const pad = (n: number) => String(n).padStart(2, '0');
// Local-date keys for stored records: the week's Monday, and the month.
export const weekKey = (ms: number) => {
  const d = new Date(weekStart(ms));
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
export const monthKey = (ms: number) => {
  const d = new Date(ms);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
};
export function monthBounds(ms: number): { from: number; to: number } {
  const d = new Date(ms);
  return { from: new Date(d.getFullYear(), d.getMonth(), 1).getTime(), to: new Date(d.getFullYear(), d.getMonth() + 1, 1).getTime() };
}

export type Quest =
  | { kind: 'sessions'; need: number }
  | { kind: 'group'; group: Group; need: number }
  | { kind: 'rir'; need: number }
  | { kind: 'cardio'; need: number }
  | { kind: 'pr'; need: number };

const workSets = (w: Workout, byId: ById) =>
  w.entries.flatMap((e) => (byId(e.exerciseId)?.mode === 'time' ? [] : e.sets.filter((s) => s.done && s.phase === 'work')));

const trains = (w: Workout, g: Group, byId: ById) =>
  w.entries.some((e) => e.sets.some((s) => s.done && s.phase === 'work') && byId(e.exerciseId)?.primaryMuscles.some((m) => groupOf(m) === g));

const fullRir = (w: Workout, byId: ById) => {
  const sets = workSets(w, byId);
  return sets.length > 0 && sets.every((s) => s.rir !== undefined);
};

// Workouts (of `among`) with a working weight above every earlier session's best for that exercise.
function prWorkouts(among: readonly Workout[], all: readonly Workout[]): number {
  return among.filter((w) =>
    w.entries.some((e) => {
      let best: number | null = null;
      for (const x of all) {
        if (x.start >= w.start) continue;
        for (const y of x.entries) if (y.exerciseId === e.exerciseId) for (const s of y.sets) if (s.done && s.phase === 'work' && (best === null || s.w > best)) best = s.w;
      }
      return best !== null && e.sets.some((s) => s.done && s.phase === 'work' && s.w > best!);
    }),
  ).length;
}

// The week's quests, from the plan and the lookback before the week. Same inputs, same quests.
export function generateQuests(input: {
  daysPerWeek: number; // the plan's sessions, cardio days included
  planGroups: readonly Group[]; // groups the plan's exercises train
  wantsCardio: boolean; // plan has cardio, or goals include lose fat / endurance
  workouts: readonly Workout[];
  exerciseById: ById;
  now: number;
}): Quest[] {
  const from = weekStart(input.now);
  const recent = input.workouts.filter((w) => w.start < from && w.start >= from - GAME.questLookbackDays * DAY);
  const quests: Quest[] = [];
  if (input.daysPerWeek > 0) quests.push({ kind: 'sessions', need: input.daysPerWeek });
  const groups = GROUPS.filter((g) => input.planGroups.includes(g));
  if (groups.length > 0) {
    const times = (g: Group) => recent.filter((w) => trains(w, g, input.exerciseById)).length;
    const group = groups.reduce((a, b) => (times(b) < times(a) ? b : a));
    quests.push({ kind: 'group', group, need: GAME.questGroupTimes });
  }
  if (input.wantsCardio) quests.push({ kind: 'cardio', need: 1 });
  else if (recent.length === 0 || !recent.every((w) => fullRir(w, input.exerciseById))) quests.push({ kind: 'rir', need: GAME.questRirSessions });
  else quests.push({ kind: 'pr', need: 1 });
  return quests;
}

// How far a quest is in the week that contains `weekOf`.
export function questHave(
  q: Quest,
  h: { workouts: readonly Workout[]; cardio: readonly CardioSession[]; slotStarts: readonly number[]; exerciseById: ById; weekOf: number },
): number {
  const from = weekStart(h.weekOf);
  const to = nextWeek(from);
  const inWeek = (t: number) => t >= from && t < to;
  const ws = h.workouts.filter((w) => inWeek(w.start));
  const have =
    q.kind === 'sessions'
      ? h.slotStarts.filter(inWeek).length
      : q.kind === 'group'
        ? ws.filter((w) => trains(w, q.group, h.exerciseById)).length
        : q.kind === 'rir'
          ? ws.filter((w) => fullRir(w, h.exerciseById)).length
          : q.kind === 'cardio'
            ? h.cardio.filter((c) => inWeek(c.start)).length
            : prWorkouts(ws, h.workouts);
  return Math.min(have, q.need);
}

export interface MonthlyRecap {
  sessions: number; // lifting + cardio
  volumeKg: number;
  prs: number; // sessions with a record
  xp: number; // muscles + cardio earned in the month
  ranksGained: { group: Group; from: Rank; to: Rank }[];
  topGroups: Group[]; // most XP in the month
}

// The month that contains `ms`, from the full history.
export function monthlyRecap(input: ProgressInput, ms: number): MonthlyRecap {
  const { from, to } = monthBounds(ms);
  const cardio = input.cardio ?? [];
  const at = (t: number) => ({
    ...input,
    workouts: input.workouts.filter((w) => w.start < t),
    cardio: cardio.filter((c) => c.start < t),
    now: t,
  });
  const before = computeProgress(at(from));
  const after = computeProgress(at(to));
  const ws = input.workouts.filter((w) => w.start >= from && w.start < to);
  const delta = (g: Group) => after.muscles[g].xp - before.muscles[g].xp;
  return {
    sessions: ws.length + cardio.filter((c) => c.start >= from && c.start < to).length,
    volumeKg: ws.reduce((sum, w) => sum + workSets(w, input.exerciseById as ById).reduce((s, x) => s + x.w * x.r, 0), 0),
    prs: prWorkouts(ws, input.workouts),
    xp: GROUPS.reduce((s, g) => s + delta(g), after.cardioXp - before.cardioXp),
    ranksGained: GROUPS.flatMap((g) =>
      RANKS.indexOf(after.muscles[g].rank) > RANKS.indexOf(before.muscles[g].rank) ? [{ group: g, from: before.muscles[g].rank, to: after.muscles[g].rank }] : [],
    ),
    topGroups: GROUPS.filter((g) => delta(g) > 0)
      .sort((a, b) => delta(b) - delta(a))
      .slice(0, GAME.recapTopMuscles),
  };
}
