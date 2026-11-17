// The time budget of a training day (owner decision 2026-11-17): the session length minus the warm-up, the cool-down
// and the day's mobility and cardio blocks. What is left is for the exercises. Pure.
import { ROUTINE, SESSION_TIME, TRAINING } from '../config/thresholds';
import { daySeconds, type TimedItem } from '../../shared/session-time';
import type { Exercise } from './exercise';
import { repRangeFor } from './reps';
import { supersetsOf } from './superset';
import type { TemplateDay } from './template';
import type { Settings } from './types';

export const sessionMinutesOf = (s: Pick<Settings, 'sessionMinutes'>): number => s.sessionMinutes ?? SESSION_TIME.defaultMinutes;

// Rest used for estimates: the rest timer's setting, or the default when the timer is off (people still rest).
export const restForEstimate = (s: Pick<Settings, 'restSec'>): number => (s.restSec > 0 ? s.restSec : TRAINING.restSec);

// The rules' warm-up and cool-down (domain/routine.ts): a pulse raiser and stretches before, stretches after.
export const routineSeconds = (): number =>
  ROUTINE.pulseSeconds + ROUTINE.warmupStretches * ROUTINE.warmupStretchSeconds + ROUTINE.cooldownStretches * ROUTINE.cooldownStretchSeconds;

// Seconds left for the exercises on a day with these extra blocks. Never below zero.
export function liftingBudgetSec(s: Pick<Settings, 'sessionMinutes'>, day: Pick<TemplateDay, 'mobilityMinutes' | 'postCardioMinutes'>): number {
  const extra = (day.mobilityMinutes ?? 0) + (day.postCardioMinutes ?? 0);
  return Math.max(0, sessionMinutesOf(s) * 60 - routineSeconds() - extra * 60);
}

// A plan day as timed items: each exercise at its planned sets and the top of its rep range (the longest the session
// gets before the weight goes up). Unknown ids count as a default reps exercise.
export function dayItems(day: Pick<TemplateDay, 'exerciseIds' | 'targets'>, byId: (id: string) => Exercise | undefined): TimedItem[] {
  return day.exerciseIds.map((id) => {
    const ex = byId(id);
    const t = day.targets?.[id];
    const range = ex ? repRangeFor(ex) : { min: 10, max: 10 };
    return {
      id,
      sets: t?.sets ?? TRAINING.defaultSets,
      reps: t?.repMax ?? range.max,
      ...(ex?.mode === 'time' ? { timed: true } : {}),
      ...(ex?.unilateral ? { unilateral: true } : {}),
    };
  });
}

// Estimated lifting seconds of a plan day.
export function planDaySeconds(
  day: Pick<TemplateDay, 'exerciseIds' | 'targets' | 'supersets'>,
  byId: (id: string) => Exercise | undefined,
  restSec: number,
): number {
  return daySeconds(dayItems(day, byId), supersetsOf(day), restSec);
}

// The whole session in minutes, for display: lifting, plus the day's warm-up, cool-down, mobility and cardio.
export function sessionMinutesEstimate(
  day: Pick<TemplateDay, 'exerciseIds' | 'targets' | 'supersets' | 'warmup' | 'cooldown' | 'mobilityMinutes' | 'postCardioMinutes'>,
  byId: (id: string) => Exercise | undefined,
  restSec: number,
): number {
  // A preview holds the generic placeholder items until withRoutines derives the real ones: count the rules' routine then.
  const items = [...day.warmup, ...day.cooldown];
  const routine = items.length > 0 && items.every((r) => r.exerciseId) ? items.reduce((sum, r) => sum + r.seconds, 0) : routineSeconds();
  const extra = ((day.mobilityMinutes ?? 0) + (day.postCardioMinutes ?? 0)) * 60;
  return Math.ceil((planDaySeconds(day, byId, restSec) + routine + extra) / 60);
}
