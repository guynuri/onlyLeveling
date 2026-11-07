import { describe, it, expect } from 'vitest';
import type { Exercise } from './exercise';
import type { Plan } from './plan';
import { routineCatalogue, rulesRoutine, withRoutines } from './routine';

const ex = (id: string, o: Partial<Exercise> = {}): Exercise =>
  ({ id, name: id, category: 'strength', equipment: 'dumbbell', requires: ['dumbbell'], level: 'beginner', primaryMuscles: [], secondaryMuscles: [], ...o }) as Exercise;
const stretch = (id: string, muscle: string, o: Partial<Exercise> = {}) =>
  ex(id, { category: 'stretching', equipment: 'bodyweight', requires: [], primaryMuscles: [muscle], ...o });

const cat = [
  stretch('s_chest1', 'chest'),
  stretch('s_chest2', 'chest'),
  stretch('s_tri', 'triceps'),
  stretch('s_sh', 'shoulders'),
  stretch('s_kit', 'chest', { equipment: 'other' }), // needs something: never picked
  stretch('s_expert', 'chest', { level: 'expert' }),
  ex('fx_Fast_Skipping', { category: 'plyometrics', equipment: 'bodyweight', requires: [] }),
  ex('bench', { primaryMuscles: ['chest'], secondaryMuscles: ['triceps', 'shoulders'] }),
];
const bench = cat[cat.length - 1];

describe('rulesRoutine', () => {
  it('warm-up: pulse raiser then stretches for the most-worked muscles; cool-down: three stretches', () => {
    const r = rulesRoutine([bench], cat, 0);
    expect(r.warmup.map((i) => i.exerciseId)).toEqual(['fx_Fast_Skipping', 's_chest1', 's_sh']); // chest, then shoulders (ties by name)
    expect(r.cooldown.map((i) => i.exerciseId)).toEqual(['s_chest2', 's_tri']); // no stretch reused; only 2 left that fit
    expect(r.warmup[0].seconds).toBe(180);
  });
  it('rotates choices by day and falls back to generic items with nothing to stretch', () => {
    expect(rulesRoutine([bench], cat, 1).warmup[1].exerciseId).toBe('s_chest2');
    const none = rulesRoutine([ex('x')], [ex('x')], 0);
    expect(none.warmup[0].exerciseId).toBeUndefined();
    expect(none.cooldown.length).toBeGreaterThan(0);
  });
  it('AI may pick only no-kit stretches and the pulse raisers', () => {
    expect(routineCatalogue(cat).map((e) => e.id).sort()).toEqual(['fx_Fast_Skipping', 's_chest1', 's_chest2', 's_sh', 's_tri']);
  });
});

describe('withRoutines', () => {
  const plan = (warmup: Plan['days'][number]['warmup']): Plan =>
    ({ days: [{ index: 0, exerciseIds: ['bench'], warmup, cooldown: [] }, { index: 1, kind: 'cardio', exerciseIds: [], warmup: [], cooldown: [] }] }) as unknown as Plan;
  it('derives rules routines but keeps AI picks and cardio days', () => {
    const ai = [{ name: 'Mine', seconds: 30, exerciseId: 's_tri', by: 'ai' as const }];
    expect(withRoutines(plan(ai), cat).days[0].warmup).toEqual(ai);
    expect(withRoutines(plan([{ name: 'Light cardio', seconds: 300 }]), cat).days[0].warmup[0].exerciseId).toBe('fx_Fast_Skipping');
    expect(withRoutines(plan([]), cat).days[1].warmup).toEqual([]);
  });
});
