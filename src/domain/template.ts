// Rules-based plan (SPEC §5.6 fallback; PLAN Phase 3). Deterministic: same input, same plan.
import { movementPattern, usableWith, type Exercise } from './exercise';
import type { CardioType } from './cardio';
import type { EquipmentChoice } from './types';

export interface TemplateInput {
  daysPerWeek: number;
  exercisesPerDay: number;
  avoid: readonly string[]; // exercise ids or names
  catalogue: readonly Exercise[];
  equipment: readonly EquipmentChoice[]; // what the user owns; nothing → bodyweight only
}

// A timed routine item (warm-up or cool-down). Never an exercise, never a set.
export interface RoutineItem {
  name: string;
  seconds: number;
}

// What one exercise asks for in a plan: sets and a rep range (U4). Absent: the library default for the exercise.
export interface Target {
  sets: number;
  repMin: number;
  repMax: number;
}

export interface TemplateDay {
  index: number;
  label?: string; // e.g. "Upper", "Pull"
  targets?: Record<string, Target>; // by exercise id
  kind?: 'cardio'; // a standalone cardio day: no exercises, logged with the cardio form (U5b)
  cardio?: { type: CardioType; minutes: number }; // what a cardio day asks for
  postCardioMinutes?: number; // a cardio block after the lifting (U5 logs it)
  mobilityMinutes?: number;
  warmup: RoutineItem[];
  exerciseIds: string[]; // catalogue ids only
  cooldown: RoutineItem[];
}

export interface Template {
  days: TemplateDay[];
}

// Candidates: usable with the owned equipment, a known movement pattern, not avoided. Compound lifts first, then ones with
// pictures (UX design §3.2), then by id.
export function candidates(input: TemplateInput): Exercise[] {
  const avoid = new Set(input.avoid);
  return input.catalogue
    .filter((ex) => usableWith(ex, input.equipment))
    .filter((ex) => movementPattern(ex) !== 'unknown')
    // A starter plan: rep-based strength work, nothing expert (U4 replaces this builder).
    .filter((ex) => ex.category === 'strength' && ex.mode === 'reps' && ex.level !== 'expert')
    .filter((ex) => !avoid.has(ex.id) && !avoid.has(ex.name))
    .sort((a, b) => {
      const ca = a.mechanic === 'compound' ? 0 : 1;
      const cb = b.mechanic === 'compound' ? 0 : 1;
      const ma = a.media ? 0 : 1;
      const mb = b.media ? 0 : 1;
      return ca - cb || ma - mb || a.id.localeCompare(b.id);
    });
}
