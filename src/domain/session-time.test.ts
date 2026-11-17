import { describe, it, expect } from 'vitest';
import { liftingBudgetSec, restForEstimate, routineSeconds, sessionMinutesEstimate, sessionMinutesOf } from './session-time';
import { SESSION_TIME, TRAINING } from '../config/thresholds';
import type { Exercise } from './exercise';

const press = { id: 'p', mechanic: 'compound', mode: 'reps' } as Exercise;
const byId = (id: string) => (id === 'p' ? press : undefined);

describe('session time budget', () => {
  it('the budget is the session minus warm-up, cool-down, mobility and cardio', () => {
    expect(liftingBudgetSec({ sessionMinutes: 45 }, {})).toBe(45 * 60 - routineSeconds());
    expect(liftingBudgetSec({ sessionMinutes: 45 }, { mobilityMinutes: 5, postCardioMinutes: 20 })).toBe(45 * 60 - routineSeconds() - 25 * 60);
    expect(liftingBudgetSec({ sessionMinutes: 30 }, { postCardioMinutes: 30 })).toBe(0);
  });
  it('no session length means the default', () => {
    expect(sessionMinutesOf({})).toBe(SESSION_TIME.defaultMinutes);
  });
  it('rest timer off still estimates the default rest', () => {
    expect(restForEstimate({ restSec: 0 })).toBe(TRAINING.restSec);
    expect(restForEstimate({ restSec: 60 })).toBe(60);
  });
  it('the session estimate adds the routine and the extra blocks to the lifting', () => {
    const day = { exerciseIds: ['p'], targets: { p: { sets: 3, repMin: 6, repMax: 10 } }, warmup: [], cooldown: [], postCardioMinutes: 10 };
    const lifting = 3 * 10 * SESSION_TIME.secondsPerRep + 2 * 90 + SESSION_TIME.changeoverSec;
    expect(sessionMinutesEstimate(day, byId, 90)).toBe(Math.ceil((lifting + routineSeconds() + 600) / 60));
    const real = { ...day, warmup: [{ name: 'w', seconds: 60, exerciseId: 'x' }], cooldown: [{ name: 'c', seconds: 60, exerciseId: 'y' }] };
    expect(sessionMinutesEstimate(real, byId, 90)).toBe(Math.ceil((lifting + 120 + 600) / 60));
  });
});
