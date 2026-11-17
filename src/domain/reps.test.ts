import { describe, it, expect } from 'vitest';
import { repRangeFor } from './reps';
import { REP_RANGES } from '../config/thresholds';

describe('repRangeFor', () => {
  it('compound and isolation lifts keep their ranges', () => {
    expect(repRangeFor({ mechanic: 'compound', primaryMuscles: ['chest'] })).toEqual(REP_RANGES.compound);
    expect(repRangeFor({ mechanic: 'isolation', primaryMuscles: ['biceps'] })).toEqual(REP_RANGES.isolation);
    expect(repRangeFor({ mechanic: null })).toEqual(REP_RANGES.isolation);
  });
  it('abs and calves get 10 to 20, compound or not', () => {
    expect(repRangeFor({ mechanic: 'isolation', primaryMuscles: ['abdominals'] })).toEqual({ min: 10, max: 20 });
    expect(repRangeFor({ mechanic: 'compound', primaryMuscles: ['calves'] })).toEqual({ min: 10, max: 20 });
    expect(repRangeFor({ mechanic: 'isolation', primaryMuscles: ['abdominals', 'calves'] })).toEqual({ min: 10, max: 20 });
  });
  it('an exercise that also mainly trains another muscle keeps its usual range', () => {
    expect(repRangeFor({ mechanic: 'compound', primaryMuscles: ['abdominals', 'quadriceps'] })).toEqual(REP_RANGES.compound);
  });
  it('a timed hold is seconds, even for abs', () => {
    expect(repRangeFor({ mechanic: 'isolation', mode: 'time', primaryMuscles: ['abdominals'] })).toEqual(REP_RANGES.hold);
  });
});
