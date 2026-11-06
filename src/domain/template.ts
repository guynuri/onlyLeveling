// Rules-based plan (SPEC §5.6 fallback; PLAN Phase 3). Deterministic: same input, same plan.
import { isDumbbellCompatible, movementPattern, type Exercise } from './exercise';
import { ROUTINE } from '../config/thresholds';

export interface TemplateInput {
  daysPerWeek: number;
  exercisesPerDay: number;
  avoid: readonly string[]; // exercise ids or names
  catalogue: readonly Exercise[];
}

// A timed routine item (warm-up or cool-down). Never an exercise, never a set.
export interface RoutineItem {
  name: string;
  seconds: number;
}

export interface TemplateDay {
  index: number;
  warmup: RoutineItem[];
  exerciseIds: string[]; // catalogue ids only
  cooldown: RoutineItem[];
}

export interface Template {
  days: TemplateDay[];
}

// Candidates: dumbbell-compatible, a known movement pattern, not avoided. Compound lifts first, then ones with
// pictures (UX design §3.2), then by id.
export function candidates(input: TemplateInput): Exercise[] {
  const avoid = new Set(input.avoid);
  return input.catalogue
    .filter((ex) => isDumbbellCompatible(ex))
    .filter((ex) => movementPattern(ex) !== 'unknown')
    .filter((ex) => !avoid.has(ex.id) && !avoid.has(ex.name))
    .sort((a, b) => {
      const ca = a.mechanic === 'compound' ? 0 : 1;
      const cb = b.mechanic === 'compound' ? 0 : 1;
      const ma = a.media ? 0 : 1;
      const mb = b.media ? 0 : 1;
      return ca - cb || ma - mb || a.id.localeCompare(b.id);
    });
}

// Each day takes the next exercisesPerDay candidates in a rotating window, so days differ and
// no exercise repeats within a day.
export function buildTemplate(input: TemplateInput): Template {
  const pool = candidates(input);
  const per = Math.min(input.exercisesPerDay, pool.length);
  const days: TemplateDay[] = [];
  for (let d = 0; d < input.daysPerWeek; d++) {
    const ids: string[] = [];
    for (let k = 0; k < per; k++) {
      ids.push(pool[(d * per + k) % pool.length].id);
    }
    days.push({
      index: d,
      warmup: ROUTINE.warmup.map((r) => ({ ...r })),
      exerciseIds: ids,
      cooldown: ROUTINE.cooldown.map((r) => ({ ...r })),
    });
  }
  return { days };
}
