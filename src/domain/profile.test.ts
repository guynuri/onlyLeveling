import { describe, it, expect } from 'vitest';
import {
  goalsOf,
  equipmentOf,
  blendGoals,
  excludedByLimits,
  blockedIds,
  onboardingSteps,
  parseAbout,
  validateWeights,
} from './profile';
import type { Settings } from './types';
import type { Exercise } from './exercise';

const base: Settings = { daysPerWeek: 3, restSec: 90, owned: [] };
const ex = (id: string, primary: Exercise['muscles']['primary'], tags?: string[]) =>
  ({ id, muscles: { primary, secondary: [] }, ...(tags ? { tags } : {}) }) as unknown as Exercise;

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

describe('onboardingSteps', () => {
  it('a new account runs all nine steps', () => {
    expect(onboardingSteps(base)).toHaveLength(9);
  });
  it('an account onboarded before v2 sees only the new steps', () => {
    expect(onboardingSteps({ ...base, goal: 'strength', owned: [4], onboardedAt: 1 })).toEqual(['goals', 'about', 'equipment', 'weights', 'limits']);
  });
  it('a fully onboarded account sees none', () => {
    expect(onboardingSteps({ ...base, onboardedAt: 1, onboardedV2At: 2 })).toEqual([]);
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
