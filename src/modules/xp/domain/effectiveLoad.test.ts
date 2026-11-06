import { describe, it, expect } from 'vitest';
import { xpLoad } from './effectiveLoad';
import type { Exercise } from '../../../domain/exercise';

const ex = (name: string, over: Partial<Exercise> = {}) =>
  ({ name, equipment: 'bodyweight', requires: [], mode: 'reps', ...over }) as Pick<Exercise, 'name' | 'equipment' | 'requires' | 'mode'>;

describe('xpLoad', () => {
  it('a push-up counts 65% of bodyweight', () => {
    const l = xpLoad(ex('Push-Up'), 80);
    expect(l).toEqual({ kind: 'fixed', kg: 52, usedDefault: false });
  });
  it('a pull-up counts all of it, whatever the bar equipment says', () => {
    expect(xpLoad(ex('Pull-Up', { requires: ['pullup_bar'] }), 80)).toMatchObject({ kind: 'fixed', kg: 80 });
  });
  it('an exercise not in the table uses the default fraction', () => {
    expect(xpLoad(ex('Burpee'), 80)).toMatchObject({ kind: 'fixed', kg: 40 });
  });
  it('no bodyweight logged uses the default bodyweight and says so', () => {
    expect(xpLoad(ex('Push-Up'), null)).toEqual({ kind: 'fixed', kg: 45.5, usedDefault: true });
  });
  it('a band set counts the fixed band load, whatever the bodyweight', () => {
    expect(xpLoad(ex('Band Pull Apart', { equipment: 'band', requires: ['band'] }), 80)).toEqual({ kind: 'fixed', kg: 10, usedDefault: false });
  });
  it('dumbbell and kettlebell work keeps the weight that was entered', () => {
    expect(xpLoad(ex('Curl', { equipment: 'dumbbell', requires: ['dumbbell'] }), 80)).toEqual({ kind: 'entered' });
    expect(xpLoad(ex('Swing', { equipment: 'kettlebell', requires: ['kettlebell'] }), 80)).toEqual({ kind: 'entered' });
  });
  it('a timed exercise earns no muscle XP', () => {
    expect(xpLoad(ex('Plank', { mode: 'time' }), 80)).toEqual({ kind: 'timed' });
  });
});
