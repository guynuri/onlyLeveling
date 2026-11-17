// The prompt sent to a provider (SPEC §5.3, §5.4). Built from structured fields and library ids only: no free text from
// the user, no dates of birth, no raw logs. Pure.
import type { Candidate } from './ai-plan';
import { ROUTINE, SESSION_TIME, SUPERSET, TRAINING } from '../src/config/thresholds';
import { daySeconds, minutesOf } from './session-time';

export interface PlanRequest {
  summary: Record<string, unknown>; // SPEC §5.3 fields, built on the device
  candidates: Record<string, Candidate>;
  daysPerWeek: number;
  exercisesPerDay: number;
  owned: number[];
  avoid: string[];
  supersets?: boolean; // the athlete asked for supersets (a switch, not free text)
  supersetSize?: 2 | 3; // the largest superset they want
  routine?: Record<string, string>; // warm-up and cool-down choices, id → name
  // Owner decision 2026-11-17, optional (older apps omit them):
  dayBudgetSec?: number[]; // lifting seconds per day (session minus warm-up, cool-down, cardio and mobility)
  restSec?: number; // rest between sets, for the time estimate
  focus?: string[]; // focus muscle groups, checked by the validator (the prompt reads them from the summary)
}

const SCHEMA = `{"plan":{"name":"string, max 60 chars","days":[{"label":"Day A","exercises":[{"exerciseId":"one id from the list","reason":"string, max 200 chars","w":number,"reps":integer,"sets":integer 1-5,"superset":"optional single letter A-Z"}],"warmup":["optional ids from the stretch list"],"cooldown":["optional ids from the stretch list"]}]},"note":"string, max 400 chars, training guidance wording"}`;

// Rough minutes for one exercise at 3 sets at the top of its range, as the time check counts it (shared/session-time.ts).
function minutesText(c: Candidate, restSec: number): string {
  const item = { id: 'x', sets: TRAINING.defaultSets, reps: c.repMax, ...(c.timed ? { timed: true } : {}), ...(c.unilateral ? { unilateral: true } : {}) };
  return ` | ~${minutesOf(daySeconds([item], [], restSec))} min for ${TRAINING.defaultSets} sets`;
}

// One line per day budget: "Day 1: 37 min".
function budgetText(budgets: readonly number[]): string {
  return budgets.map((b, i) => `Day ${i + 1}: ${minutesOf(b)} min`).join(', ');
}

export function buildPrompt(req: PlanRequest): string {
  const loadText = (c: Candidate) => (c.loads === null ? ' | no weight (w 0)' : c.loads === undefined ? '' : ` | weights ${c.loads.join(', ')}`);
  const timed = req.dayBudgetSec !== undefined;
  const rest = req.restSec ?? TRAINING.restSec;
  const lines = Object.entries(req.candidates).map(
    ([id, c]) =>
      `${id} | ${c.name}${c.groups && c.groups.length > 0 ? ` | ${c.groups.join(', ')}` : ''} | ${c.timed ? 'seconds' : 'reps'} ${c.repMin}-${c.repMax}${loadText(c)}${timed ? minutesText(c, rest) : ''}`,
  );
  return [
    'You propose a first home training plan using only the equipment each exercise needs; every listed exercise is one the athlete can do.',
    timed
      ? `Make exactly ${req.daysPerWeek} days. Fill each day to its time for lifting, not past it: ${budgetText(req.dayBudgetSec!)}. Each exercise's rough time at ${TRAINING.defaultSets} sets is in the list; every extra set, rest of ${rest} s and the change to the next exercise are counted. A superset saves time: the rest comes once per round. At least ${SESSION_TIME.minExercises} and at most ${req.exercisesPerDay} exercises per day. No exercise may repeat within a day.`
      : `Make exactly ${req.daysPerWeek} days. At most ${req.exercisesPerDay} exercises per day. No exercise may repeat within a day.`,
    'Muscles recover at different speeds. Core (abs) and calves recover fast: they can be trained in most sessions, and more often when they are focus muscles. Hamstrings, glutes, lower back and heavy quad work need about 48 to 72 hours: do not load the same one hard on back-to-back days. Chest, back, shoulders and arms need about 48 hours.',
    `Weights w are in kg and must come from the exercise's own weights list; when it says no weight, use w 0. Otherwise use the owned list: ${req.owned.join(', ') || 'any'}.`,
    'Use only exerciseId values from the list below. Do not use exercises not on the list.',
    req.supersets
      ? `Use supersets: give ${req.supersetSize === 2 ? 'exactly 2' : `${SUPERSET.minSize} to ${req.supersetSize ?? SUPERSET.maxSize}`} exercises that sit next to each other in a day the same "superset" letter (A, B, ...). Pair muscles that do not compete, for example a push with a pull. A letter is used for one run of exercises only.`
      : 'Do not use the "superset" field.',
    'Reply with JSON only, no text before or after it, exactly in this shape:',
    SCHEMA,
    'Plain text only in every string: no HTML, no Markdown, no links.',
    `Athlete summary (JSON): ${JSON.stringify(req.summary)}`,
    ...(Array.isArray(req.summary.focus) && req.summary.focus.length > 0
      ? ['The "focus" muscles in the summary are priorities: give each of them more weekly sets than any other muscle, spread over the week, and make room for them first when time is short. Focus exercises are listed first.']
      : []),
    `Exercise list (id | name | muscle groups | rep range, or seconds for a hold | weights${timed ? ' | rough time' : ''}):`,
    ...lines,
    ...(req.routine && Object.keys(req.routine).length > 0
      ? [
          `For each day you may add "warmup" (a pulse raiser first, then easy stretches) and "cooldown" (stretches), each up to ${ROUTINE.aiMaxItems} ids, chosen for the muscles that day works.`,
          'Stretch list (id | name):',
          ...Object.entries(req.routine).map(([id, name]) => `${id} | ${name}`),
        ]
      : []),
  ].join('\n');
}
