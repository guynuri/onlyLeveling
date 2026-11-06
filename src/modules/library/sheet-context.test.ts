import { describe, it, expect } from 'vitest';
import { readSheetContext } from './sheet-context';
import type { Plan } from '../../domain/plan';
import type { Exercise } from '../../domain/exercise';

const plan = { daysPerWeek: 3, days: [], adjustments: [], updatedAt: 1 } as Plan;
const squat = { id: 'squat', muscles: { primary: ['quadriceps'], secondary: [] } } as unknown as Exercise;

describe('readSheetContext', () => {
  it('reads the saved plan, workouts, blocked ids and body figure, and never saves anything', async () => {
    let saves = 0;
    const repo = {
      getSettings: async () => ({
        daysPerWeek: 3,
        restSec: 90,
        owned: [4],
        avoid: ['fx_x'],
        limits: { parts: ['knee' as const], note: '' },
        about: { sex: 'female' as const },
      }),
      getPlan: async () => plan,
      listWorkouts: async () => [],
      savePlan: async () => void saves++,
    };
    const ctx = await readSheetContext(repo, 123, [squat]);
    expect(ctx).toEqual({ plan, workouts: [], blocked: ['fx_x', 'squat'], sex: 'female', now: 123 });
    expect(saves).toBe(0);
  });

  it('with no saved plan there is no plan (no Swap), the figure is male, and still nothing is saved', async () => {
    let saves = 0;
    const repo = {
      getSettings: async () => undefined,
      getPlan: async () => undefined,
      listWorkouts: async () => [],
      savePlan: async () => void saves++,
    };
    const ctx = await readSheetContext(repo, 1, []);
    expect(ctx.plan).toBeNull();
    expect(ctx.sex).toBe('male');
    expect(saves).toBe(0);
  });
});
