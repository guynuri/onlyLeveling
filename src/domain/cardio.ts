// A cardio session (UX design §6.5, U5b). Pure: validation, XP and the streak rule. Storage and sync follow workouts.
import { CARDIO } from '../config/thresholds';

export type CardioType = (typeof CARDIO.types)[number]['value'];

export interface CardioSession {
  id: string;
  start: number; // epoch ms
  minutes: number;
  type: CardioType;
  distanceKm?: number;
  effort?: number; // 1 to 10
  planDay?: number; // the plan day index of a planned cardio day: the only kind that counts for the streak
  afterWorkoutId?: string; // a post-lift block: belongs to that lifting session and is not counted separately
}

type Parsed = { ok: true; value: Pick<CardioSession, 'type' | 'minutes' | 'distanceKm' | 'effort'> } | { ok: false; error: string };

const TYPES: readonly string[] = CARDIO.types.map((t) => t.value);

// The log form's values: minutes are whole, effort is 1 to 10, distance is above 0. Blank optional fields are null.
export function parseCardio(f: { type: string; minutes: number; distanceKm: number | null; effort: number | null }): Parsed {
  if (!TYPES.includes(f.type)) return { ok: false, error: 'Pick a cardio type.' };
  if (!Number.isInteger(f.minutes) || f.minutes < 1 || f.minutes > CARDIO.minutesMax) {
    return { ok: false, error: `Minutes must be a whole number from 1 to ${CARDIO.minutesMax}.` };
  }
  if (f.effort !== null && (!Number.isInteger(f.effort) || f.effort < 1 || f.effort > 10)) {
    return { ok: false, error: 'Effort must be from 1 to 10, or left empty.' };
  }
  if (f.distanceKm !== null && !(f.distanceKm > 0 && f.distanceKm <= CARDIO.distanceMax)) {
    return { ok: false, error: `Distance must be above 0 and up to ${CARDIO.distanceMax} km, or left empty.` };
  }
  return {
    ok: true,
    value: {
      type: f.type as CardioType,
      minutes: f.minutes,
      ...(f.distanceKm !== null ? { distanceKm: f.distanceKm } : {}),
      ...(f.effort !== null ? { effort: f.effort } : {}),
    },
  };
}

export function cardioXp(c: Pick<CardioSession, 'minutes' | 'effort'>): number {
  return Math.round((c.minutes * (c.effort ?? CARDIO.defaultEffort) * CARDIO.xpPerEffortMinute) / 10);
}

// Only a finished planned cardio day fills a streak slot. An extra session earns XP; a post-lift block rides with its lift.
export function countsForStreak(c: CardioSession): boolean {
  return c.planDay !== undefined;
}

// A new session from the form's parsed values. The id comes from the clock, so a second tap in the same millisecond
// cannot happen on a phone; the caller passes the link for a planned day or a post-lift block.
export function makeCardio(
  v: Pick<CardioSession, 'type' | 'minutes' | 'distanceKm' | 'effort'>,
  now: number,
  link: { planDay?: number; afterWorkoutId?: string } = {},
): CardioSession {
  return { id: `c_${now}`, start: now, ...v, ...link };
}
