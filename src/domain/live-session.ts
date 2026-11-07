// The session being logged right now (UX design §6.4). Pure: every function returns a new value and takes the clock as
// an argument. The screen keeps this in state and on the device; only Finish turns it into a saved Workout.
import type { Exercise } from './exercise';
import type { Prescription } from './progression';
import type { SetRow } from './session';
import type { Entry } from './types';
import { WORKOUT } from '../config/thresholds';

export interface LiveExercise {
  exerciseId: string;
  mode: 'reps' | 'time'; // time: a set's `r` is seconds
  prescription: Prescription; // for a timed exercise `reps` is the target seconds
  sets: SetRow[];
}

// An exercise the catalogue no longer has is left out, so a stale plan cannot break the screen.
export function buildLive(items: { exercise: Exercise | undefined; prescription: Prescription }[]): LiveExercise[] {
  return items.flatMap((i) =>
    i.exercise ? [{ exerciseId: i.exercise.id, mode: i.exercise.mode, prescription: i.prescription, sets: [] }] : [],
  );
}

// What the next set is pre-filled with: the last set you logged, else the plan. One tap on ✓ logs exactly this.
export function nextSetDefaults(le: LiveExercise): { w: number; r: number } {
  const last = le.sets.at(-1);
  return last ? { w: last.w, r: last.r } : { w: le.prescription.w, r: le.prescription.reps };
}

export function logSet(le: LiveExercise, values: { w: number; r: number }, at: number): LiveExercise {
  const row: SetRow = { w: values.w, r: values.r, done: true, phase: 'work', at };
  return { ...le, sets: [...le.sets, row] };
}

// Reps left in reserve, 0 to 4 (4 means "4 or more"). Anything else leaves the set as it was; undefined clears it.
export function setRir(le: LiveExercise, setIndex: number, rir: number | undefined): LiveExercise {
  const row = le.sets[setIndex];
  if (!row) return le;
  if (rir !== undefined && !(Number.isInteger(rir) && rir >= 0 && rir <= 4)) return le;
  const { rir: _old, ...rest } = row;
  const next: SetRow = rir === undefined ? rest : { ...rest, rir };
  return { ...le, sets: le.sets.map((s, i) => (i === setIndex ? next : s)) };
}

// How the set felt, on one scale (owner request 2026-11-07): 0 to 4+ is reps left in reserve; below zero means the set
// fell that many reps short, so `r` drops by that much (never below 0) and `missed` keeps the difference, which lets
// the rating move back up. RIR is 0 for a missed set. undefined clears the rating and restores the reps.
export function rateSet(le: LiveExercise, setIndex: number, v: number | undefined): LiveExercise {
  const row = le.sets[setIndex];
  if (!row) return le;
  if (v !== undefined && !(Number.isInteger(v) && v >= -WORKOUT.missMax && v <= WORKOUT.rirMax)) return le;
  const full0 = row.r + (row.missed ?? 0);
  if (v !== undefined && full0 + v < 1) return le; // a set keeps at least one rep: use Undo for a set not done
  const { rir: _rir, missed: _missed, ...rest } = row;
  const full = row.r + (row.missed ?? 0);
  let next: SetRow;
  if (v === undefined) next = { ...rest, r: full };
  else if (v >= 0) next = { ...rest, r: full, rir: v };
  else {
    const r = full + v;
    next = { ...rest, r, rir: 0, missed: full - r };
  }
  return { ...le, sets: le.sets.map((s, i) => (i === setIndex ? next : s)) };
}

// The rating a set shows on the scale: minus the missed reps, else its RIR.
export function ratingOf(row: SetRow | undefined): number | undefined {
  if (!row) return undefined;
  return row.missed ? -row.missed : row.rir;
}

export function undoLastSet(le: LiveExercise): LiveExercise {
  return le.sets.length === 0 ? le : { ...le, sets: le.sets.slice(0, -1) };
}

// The first exercise that still has sets to do, and which set number is next. Null when everything is done.
export function currentPosition(exs: readonly LiveExercise[]): { exercise: number; set: number } | null {
  const i = exs.findIndex((e) => e.sets.length < e.prescription.sets);
  return i === -1 ? null : { exercise: i, set: exs[i].sets.length };
}

// Only exercises with at least one logged set are saved; `planned` is what the plan asked for.
export function toEntries(exs: readonly LiveExercise[]): Entry[] {
  return exs.filter((e) => e.sets.length > 0).map((e) => ({ exerciseId: e.exerciseId, planned: e.prescription, sets: e.sets }));
}

export function canFinish(exs: readonly LiveExercise[]): { ok: true } | { ok: false; error: string } {
  return exs.some((e) => e.sets.length > 0) ? { ok: true } : { ok: false, error: 'Log at least one set first.' };
}
