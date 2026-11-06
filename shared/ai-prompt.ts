// The prompt sent to a provider (SPEC §5.3, §5.4). Built from structured fields and library ids only: no free text from
// the user, no dates of birth, no raw logs. Pure.
import type { Candidate } from './ai-plan';

export interface PlanRequest {
  summary: Record<string, unknown>; // SPEC §5.3 fields, built on the device
  candidates: Record<string, Candidate>;
  daysPerWeek: number;
  exercisesPerDay: number;
  owned: number[];
  avoid: string[];
}

const SCHEMA = `{"plan":{"name":"string, max 60 chars","days":[{"label":"Day A","exercises":[{"exerciseId":"one id from the list","reason":"string, max 200 chars","w":number,"reps":integer,"sets":integer 1-5}]}]},"note":"string, max 400 chars, training guidance wording"}`;

export function buildPrompt(req: PlanRequest): string {
  const loadText = (c: Candidate) => (c.loads === null ? ' | no weight (w 0)' : c.loads === undefined ? '' : ` | weights ${c.loads.join(', ')}`);
  const lines = Object.entries(req.candidates).map(([id, c]) => `${id} | ${c.name} | reps ${c.repMin}-${c.repMax}${loadText(c)}`);
  return [
    'You propose a first home training plan using only the equipment each exercise needs; every listed exercise is one the athlete can do.',
    `Make exactly ${req.daysPerWeek} days. At most ${req.exercisesPerDay} exercises per day. No exercise may repeat within a day.`,
    `Weights w are in kg and must come from the exercise's own weights list; when it says no weight, use w 0. Otherwise use the owned list: ${req.owned.join(', ') || 'any'}.`,
    'Use only exerciseId values from the list below. Do not use exercises not on the list.',
    'Reply with JSON only, no text before or after it, exactly in this shape:',
    SCHEMA,
    'Plain text only in every string: no HTML, no Markdown, no links.',
    `Athlete summary (JSON): ${JSON.stringify(req.summary)}`,
    'Exercise list (id | name | rep range | weights):',
    ...lines,
  ].join('\n');
}
