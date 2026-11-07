// The prompt sent to a provider (SPEC §5.3, §5.4). Built from structured fields and library ids only: no free text from
// the user, no dates of birth, no raw logs. Pure.
import type { Candidate } from './ai-plan';
import { ROUTINE, SUPERSET } from '../src/config/thresholds';

export interface PlanRequest {
  summary: Record<string, unknown>; // SPEC §5.3 fields, built on the device
  candidates: Record<string, Candidate>;
  daysPerWeek: number;
  exercisesPerDay: number;
  owned: number[];
  avoid: string[];
  supersets?: boolean; // the athlete asked for supersets (a switch, not free text)
  routine?: Record<string, string>; // warm-up and cool-down choices, id → name
}

const SCHEMA = `{"plan":{"name":"string, max 60 chars","days":[{"label":"Day A","exercises":[{"exerciseId":"one id from the list","reason":"string, max 200 chars","w":number,"reps":integer,"sets":integer 1-5,"superset":"optional single letter A-Z"}],"warmup":["optional ids from the stretch list"],"cooldown":["optional ids from the stretch list"]}]},"note":"string, max 400 chars, training guidance wording"}`;

export function buildPrompt(req: PlanRequest): string {
  const loadText = (c: Candidate) => (c.loads === null ? ' | no weight (w 0)' : c.loads === undefined ? '' : ` | weights ${c.loads.join(', ')}`);
  const lines = Object.entries(req.candidates).map(([id, c]) => `${id} | ${c.name} | reps ${c.repMin}-${c.repMax}${loadText(c)}`);
  return [
    'You propose a first home training plan using only the equipment each exercise needs; every listed exercise is one the athlete can do.',
    `Make exactly ${req.daysPerWeek} days. At most ${req.exercisesPerDay} exercises per day. No exercise may repeat within a day.`,
    `Weights w are in kg and must come from the exercise's own weights list; when it says no weight, use w 0. Otherwise use the owned list: ${req.owned.join(', ') || 'any'}.`,
    'Use only exerciseId values from the list below. Do not use exercises not on the list.',
    req.supersets
      ? `Use supersets: give ${SUPERSET.minSize} to ${SUPERSET.maxSize} exercises that sit next to each other in a day the same "superset" letter (A, B, ...). Pair muscles that do not compete, for example a push with a pull. A letter is used for one run of exercises only.`
      : 'Do not use the "superset" field.',
    'Reply with JSON only, no text before or after it, exactly in this shape:',
    SCHEMA,
    'Plain text only in every string: no HTML, no Markdown, no links.',
    `Athlete summary (JSON): ${JSON.stringify(req.summary)}`,
    'Exercise list (id | name | rep range | weights):',
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
