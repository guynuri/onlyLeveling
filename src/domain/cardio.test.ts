import { describe, it, expect } from 'vitest';
import { cardioXp, countsForStreak, parseCardio, type CardioSession } from './cardio';

const form = (over: Partial<Parameters<typeof parseCardio>[0]> = {}) => ({ type: 'run', minutes: 30, distanceKm: null, effort: null, ...over });

describe('parseCardio', () => {
  it('accepts a minimal session and a full one', () => {
    expect(parseCardio(form())).toEqual({ ok: true, value: { type: 'run', minutes: 30 } });
    expect(parseCardio(form({ type: 'bike', minutes: 45, distanceKm: 18.5, effort: 7 }))).toEqual({
      ok: true,
      value: { type: 'bike', minutes: 45, distanceKm: 18.5, effort: 7 },
    });
  });
  it.each([
    [{ minutes: 0 }, /minutes/i],
    [{ minutes: 601 }, /minutes/i],
    [{ minutes: 2.5 }, /minutes/i],
    [{ effort: 11 }, /effort/i],
    [{ effort: 0 }, /effort/i],
    [{ distanceKm: -3 }, /distance/i],
    [{ distanceKm: 0 }, /distance/i],
    [{ type: 'swim' }, /type/i],
  ])('rejects %o with a plain message', (over, message) => {
    const r = parseCardio(form(over));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(message);
  });
});

describe('cardioXp', () => {
  it('scales with minutes and effort', () => {
    expect(cardioXp({ minutes: 30, effort: 5 })).toBe(45);
    expect(cardioXp({ minutes: 60, effort: 5 })).toBe(90);
    expect(cardioXp({ minutes: 30, effort: 10 })).toBe(90);
  });
  it('uses the default effort when none was given', () => {
    expect(cardioXp({ minutes: 30 })).toBe(cardioXp({ minutes: 30, effort: 5 }));
  });
});

describe('countsForStreak', () => {
  const base: CardioSession = { id: 'c1', start: 1, minutes: 30, type: 'run' };
  it('is true only for a planned cardio day', () => {
    expect(countsForStreak({ ...base, planDay: 2 })).toBe(true);
    expect(countsForStreak({ ...base, planDay: 0 })).toBe(true);
  });
  it('is false for an extra session and for a post-lift block', () => {
    expect(countsForStreak(base)).toBe(false);
    expect(countsForStreak({ ...base, afterWorkoutId: 'w_1' })).toBe(false);
  });
});
