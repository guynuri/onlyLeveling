// The rules plan (SPEC §5.6 fallback; U4): a starter template filled from the exercises the user can actually do.
// Deterministic: the same input gives the same plan. The AI plan goes through the same blend (applyBlend).
import { AUTO_TEMPLATE, LOWER_SLUGS, REP_BIAS, ROUTINE, TEMPLATE, TEMPLATES, TRAINING } from '../config/thresholds';
import type { Exercise } from './exercise';
import { planFromTemplate, type Block, type Plan } from './plan';
import { blendGoals, blockedIds, equipmentOf, goalsOf } from './profile';
import { repRangeFor } from './reps';
import { candidates, type Target, type TemplateDay } from './template';
import type { Goal, Settings } from './types';

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
// already in this day. When that runs dry the rules relax: first the muscle rule, then the earlier-days rule.
function pickDay(pool: readonly Exercise[], slots: readonly Region[], n: number, usedBefore: ReadonlySet<string>): Exercise[] {
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
    chosen.push(pick);
    muscles.add(pick.muscles.primary[0]);
  }
  return chosen;
}

export function buildRulesPlan(input: {
  settings: Settings;
  catalogue: readonly Exercise[];
  kind: TemplateKind | 'auto';
  weeks: Block['weeks'];
  now: number;
}): { ok: true; plan: Plan } | { ok: false; error: 'no-exercises' } {
  const s = input.settings;
  const goals = goalsOf(s);
  const kind = input.kind === 'auto' ? autoTemplate(s.daysPerWeek) : input.kind;
  const bias = blendGoals(goals).repBias;
  const pool = candidates({
    daysPerWeek: s.daysPerWeek,
    exercisesPerDay: TEMPLATE.exercisesPerDay,
    avoid: [...blockedIds(s, input.catalogue)],
    catalogue: input.catalogue,
    equipment: equipmentOf(s),
  });
  const cycle = TEMPLATES[kind].cycle;
  const used = new Set<string>();
  const seen = new Map<string, number>();
  const days: TemplateDay[] = [];
  for (let i = 0; i < s.daysPerWeek; i++) {
    const spec = cycle[i % cycle.length];
    const repeat = seen.get(spec.name) ?? 0;
    seen.set(spec.name, repeat + 1);
    const picked = pickDay(pool, spec.slots as readonly Region[], TEMPLATE.exercisesPerDay, used);
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
    ...planFromTemplate(applyBlend(days, goals), s.daysPerWeek, input.now),
    block: { weeks: input.weeks, startedAt: input.now, deloadLastWeek: true },
    schedule: 'rotation',
  };
  return { ok: true, plan };
}
