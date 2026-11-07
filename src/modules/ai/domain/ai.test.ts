import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { buildPlanRequest, candidatesOf, summaryOf } from './request';
import { planFromProposal } from './apply';
import { replaceExercise } from '../../../domain/plan';
import type { Exercise } from '../../../domain/exercise';
import type { Settings } from '../../../domain/types';
import type { ValidPlan } from '../../../../shared/ai-plan';
import { buildPrompt } from '../../../../shared/ai-prompt';

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
      [
        'avoid',
        'body',
        'daysPerWeek',
        'equipment',
        'experience',
        'goals',
        'limits',
        'limitsNote',
        'owned',
        'sessionMinutes',
        'trends',
      ].sort(),
    );
  });

  it('goals, equipment, limits and body stats are sent; the limits note is capped (owner decision 2026-11-06)', () => {
    const s: Settings = {
      ...settings,
      goals: ['lose-fat', 'strength'],
      equipment: ['dumbbell', 'bench'],
      about: { sex: 'female', age: 41, heightCm: 170 },
      limits: { parts: ['knee'], note: 'x'.repeat(300) },
    };
    const sum = summaryOf(s, 68.5);
    expect(sum.goals).toEqual(['lose-fat', 'strength']);
    expect(sum.equipment).toEqual(['dumbbell', 'bench']);
    expect(sum.limits).toEqual(['knee']);
    expect(sum.limitsNote).toHaveLength(200);
    expect(sum.body).toEqual({ sex: 'female', age: 41, heightCm: 170, weightKg: 68.5 });
  });

  it('body stats are empty when nothing was given; owned weights are sent sorted; no account identity', () => {
    expect(summaryOf(settings).body).toEqual({});
    expect(summaryOf(settings).owned).toEqual([4, 8, 10]);
    expect(JSON.stringify(summaryOf(settings))).not.toMatch(/birth|username|email|token/i);
  });

  const push = ex({ id: 'bw_push', name: 'Push-up', equipment: 'bodyweight' });
  const swing = ex({ id: 'kb_swing', name: 'Swing', equipment: 'kettlebell', requires: ['kettlebell'] });

  it('the prompt lists each exercise weights, or says it carries none', () => {
    const s: Settings = { ...settings, equipment: ['dumbbell'] };
    const prompt = buildPrompt({ ...buildPlanRequest(s, [...catalogue, push], 4), });
    expect(prompt).toContain('bw_push | Push-up | reps 6-10 | no weight (w 0)');
    expect(prompt).toContain('fx_press | Press | reps 6-10 | weights 4, 8, 10');
    expect(prompt).not.toContain('dumbbells only');
  });

  it('candidates follow equipment: nothing picked → bodyweight only, with no loads', () => {
    const bare = candidatesOf([...catalogue, push, swing], [], { ...settings, equipment: [], owned: [] });
    expect(Object.keys(bare)).toEqual(['bw_push']);
    expect(bare.bw_push.loads).toBeNull();
  });

  it('dumbbell candidates carry the owned dumbbells, kettlebell ones the owned kettlebells', () => {
    const s: Settings = { ...settings, equipment: ['dumbbell', 'kettlebell'], ownedKettlebells: [12, 16] };
    const c = candidatesOf([...catalogue, push, swing], [], s);
    expect(c.fx_press.loads).toEqual([4, 8, 10]);
    expect(c.kb_swing.loads).toEqual([12, 16]);
    expect(c.bw_push.loads).toBeNull();
  });

  it('only dumbbell exercises with a known pattern, and not avoided ones, reach the AI', () => {
    const c = candidatesOf(catalogue, ['fx_avoid'], settings);
    expect(Object.keys(c).sort()).toEqual(['fx_iso', 'fx_press']);
    expect(c.fx_iso).toEqual({ name: 'Curl', repMin: 10, repMax: 15, loads: [4, 8, 10] });
  });

  it('the request carries the settings and candidates, nothing else', () => {
    const r = buildPlanRequest(settings, catalogue, 4);
    expect(Object.keys(r).sort()).toEqual(['avoid', 'candidates', 'daysPerWeek', 'exercisesPerDay', 'owned', 'summary', 'supersets']);
    expect(r.exercisesPerDay).toBe(4);
  });
});

describe('RepDB content never reaches the AI (CLAUDE.md data table)', () => {
  it('the prompt carries the name but not the description, tips or picture paths', () => {
    const rich = ex({
      id: 'rp_made-up-press',
      name: 'Made Up Press',
      description: 'UNIQUE-DESCRIPTION-TEXT',
      tips: ['UNIQUE-TIP-TEXT'],
      media: { stills: ['media/repdb/UNIQUE-STILL.webp'] },
    });
    const prompt = buildPrompt(buildPlanRequest(settings, [rich], 4));
    expect(prompt).toContain('Made Up Press');
    expect(prompt).not.toMatch(/UNIQUE-DESCRIPTION-TEXT|UNIQUE-TIP-TEXT|UNIQUE-STILL|webp/);
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

  const range = () => ({ min: 8, max: 12 });
  const two: Settings = { ...settings, daysPerWeek: 2 };

  it('days come from the proposal; each weight becomes the first-session adjustment', () => {
    const p = planFromProposal(v, two, 8, range, 1000);
    expect(p.days.map((d) => d.exerciseIds)).toEqual([['fx_press'], ['fx_iso']]);
    expect(p.adjustments).toEqual([
      { exerciseId: 'fx_press', w: 8, at: 1000 },
      { exerciseId: 'fx_iso', w: 6, at: 1000 },
    ]);
    expect(p.days[0].warmup.length).toBeGreaterThan(0);
  });

  it('keeps the AI day labels, a block, a rotation, and per-exercise sets with the library rep range', () => {
    const p = planFromProposal(v, two, 6, range, 1000);
    expect(p.days.map((d) => d.label)).toEqual(['Day A', 'Day B']);
    expect(p.block).toEqual({ weeks: 6, startedAt: 1000, deloadLastWeek: true });
    expect(p.schedule).toBe('rotation');
    expect(p.days[0].targets).toEqual({ fx_press: { sets: 3, repMin: 8, repMax: 12 } });
  });

  it('an unweighted exercise (w 0) gets no weight adjustment', () => {
    const bw: ValidPlan = { ...v, days: [{ label: 'A', exercises: [{ exerciseId: 'bw_push', reason: 'r', w: 0, reps: 10, sets: 3 }] }, v.days[1]] };
    expect(planFromProposal(bw, two, 8, range, 1000).adjustments.map((a) => a.exerciseId)).toEqual(['fx_iso']);
  });

  it('the goal blend adds mobility minutes to every day', () => {
    const p = planFromProposal(v, { ...two, goals: ['mobility'] }, 8, range, 1000);
    expect(p.days.every((d) => d.mobilityMinutes === 5)).toBe(true);
  });

  it('replacing an exercise moves it in every day and drops its weight adjustment', () => {
    const p = planFromProposal(v, two, 8, range, 1000);
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
