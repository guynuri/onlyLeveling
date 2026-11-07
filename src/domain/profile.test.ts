import { describe, it, expect } from 'vitest';
import {
  goalsOf,
  equipmentOf,
  blendGoals,
  excludedByLimits,
  blockedIds,
  lockedUntil,
  onboardingDone,
  addWeight,
  parseAbout,
  validateWeights,
  workoutViewOf,
} from './profile';
import type { Settings } from './types';
import type { Exercise } from './exercise';

const base: Settings = { daysPerWeek: 3, restSec: 90, owned: [] };
const ex = (id: string, primary: Exercise['muscles']['primary'], tags?: string[]) =>
  ({ id, muscles: { primary, secondary: [] }, ...(tags ? { tags } : {}) }) as unknown as Exercise;

describe('workoutViewOf', () => {
  it('defaults to focus and returns the saved choice', () => {
    expect(workoutViewOf(base)).toBe('focus');
    expect(workoutViewOf({ ...base, workoutView: 'list' })).toBe('list');
    expect(workoutViewOf({ ...base, workoutView: 'focus' })).toBe('focus');
  });
});

describe('goalsOf', () => {
  it('reads the list, then the legacy single goal, then a default', () => {
    expect(goalsOf({ ...base, goals: ['lose-fat', 'strength'] })).toEqual(['lose-fat', 'strength']);
    expect(goalsOf({ ...base, goals: [], goal: 'strength' })).toEqual(['strength']);
    expect(goalsOf(base)).toEqual(['build-muscle']);
  });
});

describe('equipmentOf', () => {
  it('a legacy account with owned weights has dumbbells', () => {
    expect(equipmentOf({ ...base, owned: [4, 6] })).toEqual(['dumbbell']);
    expect(equipmentOf(base)).toEqual([]);
    expect(equipmentOf({ ...base, owned: [4], equipment: ['band'] })).toEqual(['band']);
  });
});

describe('blendGoals', () => {
  it('takes the most cardio and mobility any goal asks for', () => {
    expect(blendGoals(['build-muscle', 'lose-fat'])).toEqual({ cardioSessions: 2, cardioMinutes: 20, mobilityMinutes: 0, repBias: 'none' });
  });
  it('strength alone leans heavier; strength with endurance cancels out', () => {
    expect(blendGoals(['strength']).repBias).toBe('heavier');
    expect(blendGoals(['endurance']).repBias).toBe('lighter');
    expect(blendGoals(['strength', 'endurance']).repBias).toBe('none');
  });
});

describe('excludedByLimits', () => {
  it('a knee limit excludes a quad exercise unless it is marked knee-safe', () => {
    expect(excludedByLimits(ex('squat', ['quadriceps']), ['knee'])).toBe(true);
    expect(excludedByLimits(ex('squat', ['quadriceps'], ['knee_safe']), ['knee'])).toBe(false);
    expect(excludedByLimits(ex('curl', ['biceps']), ['knee'])).toBe(false);
  });
});

describe('blockedIds', () => {
  it('unions the avoid list and the limit exclusions', () => {
    const cat = [ex('squat', ['quadriceps']), ex('curl', ['biceps']), ex('row', ['upper-back'])];
    const s: Settings = { ...base, avoid: ['row'], limits: { parts: ['knee'], note: '' } };
    expect([...blockedIds(s, cat)].sort()).toEqual(['row', 'squat']);
  });
});

describe('onboardingDone', () => {
  it('only a finished v2 onboarding counts; anything else starts it again', () => {
    expect(onboardingDone(base)).toBe(false);
    expect(onboardingDone({ ...base, goal: 'strength', owned: [4], onboardedAt: 1 })).toBe(false);
    expect(onboardingDone({ ...base, onboardedAt: 1, onboardedV2At: 2 })).toBe(true);
  });
});

describe('addWeight', () => {
  it('adds a typed weight to the owned list, sorted, without duplicates', () => {
    expect(addWeight([4, 8], '11.25')).toEqual({ ok: true, value: [4, 8, 11.25] });
    expect(addWeight([4, 8], '8')).toEqual({ ok: true, value: [4, 8] });
    expect(addWeight([], ' 6,5 ')).toEqual({ ok: true, value: [6.5] });
  });
  it('refuses blanks, zero, negatives and silly values', () => {
    for (const t of ['', 'abc', '0', '-2', '500']) expect(addWeight([], t).ok, t).toBe(false);
  });
});

describe('parseAbout', () => {
  const blank = { sex: '', age: '', heightCm: '', weightKg: '' };
  it('all blank is fine: nothing is stored', () => {
    expect(parseAbout(blank)).toEqual({ ok: true, value: { about: {}, weightKg: null } });
  });
  it('keeps what was given', () => {
    expect(parseAbout({ sex: 'female', age: '34', heightCm: '180', weightKg: '72.5' })).toEqual({
      ok: true,
      value: { about: { sex: 'female', age: 34, heightCm: 180 }, weightKg: 72.5 },
    });
  });
  it('an out-of-range number names the field', () => {
    const r = parseAbout({ ...blank, age: '7' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/age/i);
  });
});

describe('validateWeights', () => {
  it('dumbbells need at least one weight; kettlebells too when selected', () => {
    expect(validateWeights(['dumbbell'], [], [])).toMatch(/dumbbell/i);
    expect(validateWeights(['dumbbell', 'kettlebell'], [4], [])).toMatch(/kettlebell/i);
    expect(validateWeights(['band'], [], [])).toBeNull();
    expect(validateWeights(['dumbbell'], [4, 6], [])).toBeNull();
  });
});

describe('difficulty lock (lockedUntil, blockedIds)', () => {
  const ex = (id: string, level: Exercise['level'], primaryMuscles = ['chest']) =>
    ({ id, level, primaryMuscles, muscles: { primary: [], secondary: [] }, tags: [] }) as unknown as Exercise;
  const cat = [ex('easy', 'beginner'), ex('mid', 'intermediate'), ex('hard', 'expert'), ex('open', null)];
  it('intermediate needs D, expert needs B on every primary muscle', () => {
    expect(lockedUntil(cat[1], {})).toBe('D');
    expect(lockedUntil(cat[1], { chest: 'D' })).toBeNull();
    expect(lockedUntil(cat[2], { chest: 'C' })).toBe('B');
    expect(lockedUntil(ex('two', 'intermediate', ['chest', 'triceps']), { chest: 'A' })).toBe('D');
    expect(lockedUntil(cat[0], {})).toBeNull();
    expect(lockedUntil(cat[3], {})).toBeNull();
  });
  it('blocks only when the setting is on', () => {
    const s: Settings = { daysPerWeek: 3, restSec: 90, owned: [] };
    expect([...blockedIds(s, cat, {})]).toEqual([]);
    expect([...blockedIds({ ...s, lockByRank: true }, cat, { chest: 'D' })]).toEqual(['hard']);
    expect([...blockedIds({ ...s, lockByRank: true }, cat, null)]).toEqual([]); // ranks not known yet: the lock waits
  });
});
