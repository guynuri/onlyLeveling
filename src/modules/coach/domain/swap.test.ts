import { describe, it, expect } from 'vitest';
import type { Exercise } from '../../../domain/exercise';
import { pickSwap, swapCandidates, type SwapInput } from './swap';

const ex = (id: string, o: Partial<Exercise> = {}): Exercise =>
  ({
    id,
    name: id,
    equipment: 'dumbbell',
    requires: ['dumbbell'],
    force: 'push',
    mechanic: 'compound',
    primaryMuscles: ['chest'],
    ...o,
  }) as Exercise;

const from = ex('press');
const input = (catalogue: Exercise[], o: Partial<SwapInput> = {}): SwapInput => ({
  exercise: from,
  catalogue,
  inPlan: new Set(),
  avoid: new Set(),
  equipment: ['dumbbell'],
  lastUsed: new Map(),
  now: 1e12,
  ...o,
});

describe('swapCandidates', () => {
  it('ranks same pattern, then not recent, then same mechanic; filters muscle, kit, plan and avoid', () => {
    const cat = [
      ex('fly', { mechanic: 'isolation' }),
      ex('pullover', { force: 'pull' }),
      ex('incline'),
      ex('recent'),
      ex('legs', { primaryMuscles: ['quadriceps'] }),
      ex('band', { requires: ['band'], equipment: 'bands' as Exercise['equipment'] }),
      ex('inplan'),
      ex('avoided'),
    ];
    const ids = swapCandidates(
      input(cat, { inPlan: new Set(['inplan']), avoid: new Set(['avoided']), lastUsed: new Map([['recent', 1e12 - 86_400_000]]) }),
    ).map((c) => c.id);
    expect(ids).toEqual(['incline', 'fly', 'recent', 'pullover']);
  });
  it('pickSwap still requires the same movement pattern', () => {
    expect(pickSwap(input([ex('pullover', { force: 'pull' })]))).toBeNull();
    expect(pickSwap(input([ex('pullover', { force: 'pull' }), ex('incline')]))?.id).toBe('incline');
  });
});
