import { describe, it, expect } from 'vitest';
import { readSheetContext } from './sheet-context';
import type { Plan } from '../../domain/plan';

const plan = { daysPerWeek: 3, days: [], adjustments: [], updatedAt: 1 } as Plan;

describe('readSheetContext', () => {
  it('reads the saved plan, workouts and avoid list, and never saves anything', async () => {
    let saves = 0;
    const repo = {
      getSettings: async () => ({ daysPerWeek: 3, restSec: 90, owned: [4], avoid: ['fx_x'] }),
      getPlan: async () => plan,
      listWorkouts: async () => [],
      savePlan: async () => void saves++,
    };
    const ctx = await readSheetContext(repo, 123);
    expect(ctx).toEqual({ plan, workouts: [], avoid: ['fx_x'], now: 123 });
    expect(saves).toBe(0);
  });

  it('with no saved plan there is no plan (no Swap), and still nothing is saved', async () => {
    let saves = 0;
    const repo = {
      getSettings: async () => undefined,
      getPlan: async () => undefined,
      listWorkouts: async () => [],
      savePlan: async () => void saves++,
    };
    expect((await readSheetContext(repo, 1)).plan).toBeNull();
    expect(saves).toBe(0);
  });
});
