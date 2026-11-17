// The rules plan (SPEC §5.6 fallback; U4): a starter template filled from the exercises the user can actually do.
// Deterministic: the same input gives the same plan. The AI plan goes through the same blend (applyBlend).
import { AUTO_TEMPLATE, FOCUS, LOWER_SLUGS, REP_BIAS, ROUTINE, SESSION_TIME, TEMPLATES, TRAINING } from '../config/thresholds';
import type { Exercise } from './exercise';
import { planFromTemplate, type Block, type Plan } from './plan';
import { blendGoals, blockedIds, equipmentOf, goalsOf } from './profile';
import { repRangeFor } from './reps';
import { candidates, type Target, type TemplateDay } from './template';
import type { Goal, Settings } from './types';
import { AI_PLAN_LIMITS } from '../../shared/ai-plan';
import { daySeconds, trimToBudget } from '../../shared/session-time';
import { dayItems, liftingBudgetSec, restForEstimate } from './session-time';
import { GROUPS, groupOf, type Group } from '../modules/xp/domain/muscles';
import type { Rank } from '../modules/xp/domain/rank';

export type TemplateKind = keyof typeof TEMPLATES;
type Region = 'upper' | 'lower' | 'push' | 'pull';

const isLower = (ex: Exercise) => ex.muscles.primary.some((m) => (LOWER_SLUGS as readonly string[]).includes(m));
const inRegion = (ex: Exercise, region: Region) =>
  region === 'lower' ? isLower(ex) : !isLower(ex) && (region === 'upper' || ex.force === region);

export function autoTemplate(daysPerWeek: number): TemplateKind {
  if (daysPerWeek <= AUTO_TEMPLATE.fullBodyMaxDays) return 'full-body';
  return daysPerWeek <= AUTO_TEMPLATE.upperLowerMaxDays ? 'upper-lower' : 'push-pull-legs';
}

// Cardio and mobility from the goal blend (UX design §4): cardio blocks go after the lifting on the last days of the
// week, mobility on every day. Goals that ask for neither leave the days alone.
export function applyBlend(days: TemplateDay[], goals: readonly Goal[]): TemplateDay[] {
  const blend = blendGoals(goals);
  const cardioFrom = days.length - Math.min(blend.cardioSessions, days.length);
  return days.map((d, i) => ({
    ...d,
    ...(blend.cardioMinutes > 0 && blend.cardioSessions > 0 && i >= cardioFrom ? { postCardioMinutes: blend.cardioMinutes } : {}),
    ...(blend.mobilityMinutes > 0 ? { mobilityMinutes: blend.mobilityMinutes } : {}),
  }));
}

function targetFor(ex: Exercise, bias: 'none' | 'heavier' | 'lighter'): Target {
  const r = repRangeFor(ex);
  const shift = bias === 'heavier' ? REP_BIAS.heavier : bias === 'lighter' ? REP_BIAS.lighter : 0;
  const repMin = Math.max(REP_BIAS.floor, r.min + shift);
  return { sets: TRAINING.defaultSets, repMin, repMax: Math.max(repMin, r.max + shift) };
}

// One day: slot by slot, the first exercise of the slot's region that no earlier day used and whose main muscle is not
// already in this day. When that runs dry the rules relax: first the muscle rule, then the earlier-days rule. Stops at
// n exercises, or earlier once the next one would not fit (`fitsBudget`), but never before SESSION_TIME.minExercises.
function pickDay(
  pool: readonly Exercise[],
  slots: readonly Region[],
  n: number,
  usedBefore: ReadonlySet<string>,
  fitsBudget: (day: readonly Exercise[]) => boolean = () => true,
): Exercise[] {
  const chosen: Exercise[] = [];
  const muscles = new Set<string>();
  for (let k = 0; k < n; k++) {
    const region = slots[k % slots.length];
    const fits = pool.filter((e) => inRegion(e, region) && !chosen.includes(e));
    const pick =
      fits.find((e) => !usedBefore.has(e.id) && !muscles.has(e.muscles.primary[0])) ??
      fits.find((e) => !muscles.has(e.muscles.primary[0])) ??
      fits.find((e) => !usedBefore.has(e.id)) ??
      fits[0];
    if (!pick) continue;
    if (chosen.length >= SESSION_TIME.minExercises && !fitsBudget([...chosen, pick])) break;
    chosen.push(pick);
    muscles.add(pick.muscles.primary[0]);
  }
  return chosen;
}

const GROUP_SET = new Set<string>(GROUPS);
export function focusOf(s: Pick<Settings, 'focusMuscles'>): Group[] {
  return [...new Set(s.focusMuscles ?? [])].filter((g): g is Group => GROUP_SET.has(g)).slice(0, FOCUS.max);
}

const trainsGroup = (e: Exercise, g: Group) => e.primaryMuscles.some((m) => groupOf(m) === g);

// Focus muscles (owner decision 2026-11-07): for each, on the first day that trains it (else the shortest day), one
// more exercise for it from the pool (at most FOCUS.maxExtraPerDay extra per day, never past SESSION_TIME.maxExercises)
// and FOCUS.extraSets more on its first exercise there. Pure.
export function addFocus(days: TemplateDay[], focus: readonly Group[], pool: readonly Exercise[], bias: 'none' | 'heavier' | 'lighter'): TemplateDay[] {
  const out = days.map((d) => ({ ...d, exerciseIds: [...d.exerciseIds], targets: { ...d.targets } }));
  const byId = new Map(pool.map((e) => [e.id, e]));
  const used = new Set(out.flatMap((d) => d.exerciseIds));
  const extras = new Map<number, number>(); // day index → focus exercises added
  for (const g of focus) {
    if (out.length === 0) break;
    const hits = (d: TemplateDay) => d.exerciseIds.some((id) => byId.get(id) && trainsGroup(byId.get(id)!, g));
    const day = out.find(hits) ?? out.reduce((a, b) => (b.exerciseIds.length < a.exerciseIds.length ? b : a));
    const first = day.exerciseIds.find((id) => byId.get(id) && trainsGroup(byId.get(id)!, g));
    if (first && day.targets[first]) {
      day.targets[first] = { ...day.targets[first], sets: Math.min(AI_PLAN_LIMITS.setsMax, day.targets[first].sets + FOCUS.extraSets) };
    }
    const extra = pool.find((e) => trainsGroup(e, g) && !used.has(e.id)) ?? pool.find((e) => trainsGroup(e, g) && !day.exerciseIds.includes(e.id));
    if (extra && (extras.get(day.index) ?? 0) < FOCUS.maxExtraPerDay && day.exerciseIds.length < SESSION_TIME.maxExercises) {
      extras.set(day.index, (extras.get(day.index) ?? 0) + 1);
      day.exerciseIds.push(extra.id);
      day.targets[extra.id] = targetFor(extra, bias);
      used.add(extra.id);
    }
  }
  return out;
}

export function buildRulesPlan(input: {
  settings: Settings;
  catalogue: readonly Exercise[];
  kind: TemplateKind | 'auto';
  weeks: Block['weeks'];
  now: number;
  ranks?: Partial<Record<Group, Rank>> | null; // for the difficulty lock; null: not known yet
}): { ok: true; plan: Plan } | { ok: false; error: 'no-exercises' } {
  const s = input.settings;
  const goals = goalsOf(s);
  const kind = input.kind === 'auto' ? autoTemplate(s.daysPerWeek) : input.kind;
  const bias = blendGoals(goals).repBias;
  const pool = candidates({
    daysPerWeek: s.daysPerWeek,
    exercisesPerDay: SESSION_TIME.maxExercises,
    avoid: [...blockedIds(s, input.catalogue, input.ranks)],
    catalogue: input.catalogue,
    equipment: equipmentOf(s),
  });
  const cycle = TEMPLATES[kind].cycle;
  // Each day is filled to its time budget (owner decision 2026-11-17): the session minus warm-up, cool-down and the
  // day's cardio and mobility blocks.
  const rest = restForEstimate(s);
  const budgets = dayBudgetsSec(s);
  const byId = new Map(pool.map((e) => [e.id, e]));
  const secondsOf = (exs: readonly Exercise[]) =>
    daySeconds(dayItems({ exerciseIds: exs.map((e) => e.id), targets: Object.fromEntries(exs.map((e) => [e.id, targetFor(e, bias)])) }, (id) => byId.get(id)), [], rest);
  const used = new Set<string>();
  const seen = new Map<string, number>();
  const days: TemplateDay[] = [];
  for (let i = 0; i < s.daysPerWeek; i++) {
    const spec = cycle[i % cycle.length];
    const repeat = seen.get(spec.name) ?? 0;
    seen.set(spec.name, repeat + 1);
    const picked = pickDay(pool, spec.slots as readonly Region[], SESSION_TIME.maxExercises, used, (d) => secondsOf(d) <= budgets[i]);
    if (picked.length === 0) return { ok: false, error: 'no-exercises' };
    picked.forEach((e) => used.add(e.id));
    days.push({
      index: i,
      label: `${spec.name} ${String.fromCharCode(65 + repeat)}`,
      warmup: ROUTINE.warmup.map((r) => ({ ...r })),
      exerciseIds: picked.map((e) => e.id),
      targets: Object.fromEntries(picked.map((e) => [e.id, targetFor(e, bias)])),
      cooldown: ROUTINE.cooldown.map((r) => ({ ...r })),
    });
  }
  const plan: Plan = {
    ...planFromTemplate(
      fitDays(applyBlend(addFocus(days, focusOf(s), pool, bias), goals), focusOf(s), (id) => byId.get(id), rest, budgets),
      s.daysPerWeek,
      input.now,
    ),
    block: { weeks: input.weeks, startedAt: input.now, deloadLastWeek: true },
    schedule: 'rotation',
  };
  return { ok: true, plan };
}

// Lifting seconds each day of the week has (owner decision 2026-11-17), with the goal blend's cardio and mobility
// blocks on the days they land on.
export function dayBudgetsSec(s: Settings): number[] {
  const blank: TemplateDay[] = Array.from({ length: s.daysPerWeek }, (_, index) => ({ index, warmup: [], exerciseIds: [], cooldown: [] }));
  return applyBlend(blank, goalsOf(s)).map((d) => liftingBudgetSec(s, d));
}

// Drops exercises from the end of a day that runs over its budget, the ones for focus muscles last, never below
// SESSION_TIME.minExercises. Pure.
export function fitDays(
  days: TemplateDay[],
  focus: readonly Group[],
  byId: (id: string) => Exercise | undefined,
  restSec: number,
  budgets: readonly number[],
): TemplateDay[] {
  return days.map((d, i) => {
    const budget = budgets[i];
    if (budget === undefined) return d;
    const isFocus = (id: string) => {
      const ex = byId(id);
      return !!ex && focus.some((g) => trainsGroup(ex, g));
    };
    const { kept } = trimToBudget(dayItems(d, byId), d.supersets ?? [], restSec, budget, (t) => isFocus(t.id), SESSION_TIME.minExercises);
    if (kept.length === d.exerciseIds.length) return d;
    const ids = kept.map((t) => t.id);
    const keep = new Set(ids);
    return {
      ...d,
      exerciseIds: ids,
      targets: Object.fromEntries(Object.entries(d.targets ?? {}).filter(([id]) => keep.has(id))),
    };
  });
}
