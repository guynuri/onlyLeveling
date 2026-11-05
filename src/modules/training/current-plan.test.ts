// currentPlan: a plan derived from settings is saved locally only. Queuing it would let a new device push its
// default over the plan already on the server.
import { describe, it, expect } from 'vitest';
import { currentPlan } from './data';
import { planFromTemplate, type Plan } from '../../domain/plan';
import type { Repo } from '../../data/repo';
import type { Settings } from '../../domain/types';

const settings: Settings = { daysPerWeek: 3, restSec: 90, owned: [4, 6, 8, 10] };

// A repo fake that records writes. `synced` must never be written by currentPlan.
function fake(initial?: Plan) {
  const writes: Plan[] = [];
  let plan = initial;
  const repo = {
    getPlan: async () => plan,
    savePlan: async (p: Plan) => {
      writes.push(p);
      plan = p;
    },
  } as unknown as Repo;
  return { repo, writes };
}

describe('currentPlan', () => {
  it('builds a plan from settings once and saves it locally, not to the server queue', async () => {
    const synced = fake(undefined);
    const local = fake(undefined);
    const plan = await currentPlan(synced.repo, local.repo, settings, 1000);
    expect(plan.days).toHaveLength(3);
    expect(local.writes).toHaveLength(1);
    expect(synced.writes).toHaveLength(0);
  });

  it('keeps a saved plan with its adjustments and writes nothing', async () => {
    const saved: Plan = {
      ...planFromTemplate([{ index: 0, warmup: [], exerciseIds: ['x'], cooldown: [] }], 3, 1),
      adjustments: [{ exerciseId: 'x', w: 8, at: 5 }],
    };
    const synced = fake(saved);
    const local = fake(undefined);
    const plan = await currentPlan(synced.repo, local.repo, settings, 1000);
    expect(plan.adjustments).toEqual([{ exerciseId: 'x', w: 8, at: 5 }]);
    expect(local.writes).toHaveLength(0);
    expect(synced.writes).toHaveLength(0);
  });

  it('rebuilds when days per week changed', async () => {
    const saved = planFromTemplate([{ index: 0, warmup: [], exerciseIds: ['x'], cooldown: [] }], 2, 1);
    const synced = fake(saved);
    const local = fake(undefined);
    const plan = await currentPlan(synced.repo, local.repo, settings, 1000);
    expect(plan.daysPerWeek).toBe(3);
    expect(local.writes).toHaveLength(1);
  });
});
