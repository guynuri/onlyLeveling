// The session being logged right now (UX design §6.4). Pure: every function returns a new value and takes the clock as
// an argument. The screen keeps this in state and on the device; only Finish turns it into a saved Workout.
import type { Exercise } from './exercise';
import type { Prescription } from './progression';
import type { SetRow } from './session';
import type { Entry } from './types';

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
