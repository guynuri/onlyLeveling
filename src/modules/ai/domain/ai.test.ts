import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { buildPlanRequest, candidatesOf, summaryOf } from './request';
import { planFromProposal } from './apply';
import { replaceExercise } from '../../../domain/plan';
import type { Exercise } from '../../../domain/exercise';
import type { Settings } from '../../../domain/types';
import type { ValidPlan } from '../../../../shared/ai-plan';

const ex = (over: Partial<Exercise>): Exercise =>
  ({
    id: 'x',
    name: 'X',
    aliases: [],
    equipment: 'dumbbell',
    force: 'push',
    mechanic: 'compound',
    level: null,
    category: 'strength',
    primaryMuscles: ['chest'],
    secondaryMuscles: [],
    movementPattern: 'push',
    instructions: [],
    requires: [],
    mode: 'reps',
    muscles: { primary: ['chest'], secondary: [] },
    source: 'free-exercise-db',
    textSource: 'free-exercise-db',
    license: 'Unlicense',
    author: null,
    sourceUrl: null,
    ...over,
  }) as Exercise;

const catalogue = [
  ex({ id: 'fx_press', name: 'Press' }),
  ex({ id: 'fx_iso', name: 'Curl', mechanic: 'isolation' }),
  ex({ id: 'fx_barbell', name: 'Barbell Press', equipment: 'barbell' }),
  ex({ id: 'fx_unknown', name: 'Unknown Pattern', force: null, movementPattern: 'unknown' }),
  ex({ id: 'fx_avoid', name: 'Avoided' }),
];

const settings: Settings = {
  daysPerWeek: 3,
  restSec: 90,
  owned: [10, 4, 8],
  goal: 'build-muscle',
  sessionMinutes: 45,
  experience: 'beginner',
  avoid: ['fx_avoid'],
};

describe('what leaves the device (SPEC §5.3)', () => {
  it('the summary holds only the listed fields', () => {
    expect(Object.keys(summaryOf(settings)).sort()).toEqual(
      ['avoid', 'daysPerWeek', 'experience', 'goal', 'owned', 'sessionMinutes', 'trends'].sort(),
    );
  });

  it('owned weights are sent sorted, and the summary carries no bodyweight or date of birth', () => {
    expect(summaryOf(settings).owned).toEqual([4, 8, 10]);
    expect(JSON.stringify(summaryOf(settings))).not.toMatch(/kg|birth|bodyweight/i);
  });

  it('only dumbbell exercises with a known pattern, and not avoided ones, reach the AI', () => {
    const c = candidatesOf(catalogue, ['fx_avoid']);
    expect(Object.keys(c).sort()).toEqual(['fx_iso', 'fx_press']);
    expect(c.fx_iso).toEqual({ name: 'Curl', repMin: 10, repMax: 15 });
  });

  it('the request carries the settings and candidates, nothing else', () => {
    const r = buildPlanRequest(settings, catalogue, 4);
    expect(Object.keys(r).sort()).toEqual(['avoid', 'candidates', 'daysPerWeek', 'exercisesPerDay', 'owned', 'summary']);
    expect(r.exercisesPerDay).toBe(4);
  });
});

describe('a proposal becomes the saved plan', () => {
  const v: ValidPlan = {
    name: 'Starter',
    note: 'Training guidance.',
    days: [
      { label: 'Day A', exercises: [{ exerciseId: 'fx_press', reason: 'Chest', w: 8, reps: 10, sets: 3 }] },
      { label: 'Day B', exercises: [{ exerciseId: 'fx_iso', reason: 'Arms', w: 6, reps: 12, sets: 3 }] },
    ],
  };

  it('days come from the proposal; each weight becomes the first-session adjustment', () => {
    const p = planFromProposal(v, 2, 1000);
    expect(p.days.map((d) => d.exerciseIds)).toEqual([['fx_press'], ['fx_iso']]);
    expect(p.adjustments).toEqual([
      { exerciseId: 'fx_press', w: 8, at: 1000 },
      { exerciseId: 'fx_iso', w: 6, at: 1000 },
    ]);
    expect(p.days[0].warmup.length).toBeGreaterThan(0);
  });

  it('replacing an exercise moves it in every day and drops its weight adjustment', () => {
    const p = planFromProposal(v, 2, 1000);
    const next = replaceExercise(p, 'fx_press', 'fx_other', 2000);
    expect(next.days[0].exerciseIds).toEqual(['fx_other']);
    expect(next.adjustments.map((a) => a.exerciseId)).toEqual(['fx_iso']);
  });
});

describe('the frontend never names a provider endpoint or key', () => {
  it('no source file under src/ or shared/ mentions a provider host or key name', () => {
    const forbidden = ['api.anthropic.com', 'generativelanguage', 'GEMINI_API_KEY', 'ANTHROPIC_API_KEY'];
    const files: string[] = [];
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const p = join(dir, name);
        if (statSync(p).isDirectory()) walk(p);
        else if (/\.(ts|tsx)$/.test(name) && !name.endsWith('.test.ts')) files.push(p);
      }
    };
    walk(join(process.cwd(), 'src'));
    walk(join(process.cwd(), 'shared'));
    const hits = files.filter((f) => forbidden.some((w) => readFileSync(f, 'utf8').includes(w)));
    expect(hits).toEqual([]);
  });
});
