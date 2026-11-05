import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { openAppDb, type Db } from '../db/idb';
import { createRepo } from './idb-repo';
import type { Repo } from './repo';
import type { Settings, Workout } from '../domain/types';

let db: Db;
let repo: Repo;
let n = 0;

beforeEach(async () => {
  db = await openAppDb(`test-repo-${n++}`);
  repo = createRepo(db);
});

const SETTINGS: Settings = { daysPerWeek: 3, restSec: 90, owned: [4, 6, 8, 10, 12] };

const WORKOUT = (id: string, start: number): Workout => ({
  id,
  start,
  end: start + 1000,
  entries: [
    {
      exerciseId: 'fx_Dumbbell_Curl',
      planned: { w: 8, reps: 8, sets: 3 },
      sets: [{ w: 8, r: 8, done: true, phase: 'work', at: start }],
    },
  ],
});

describe('repo: settings', () => {
  it('is undefined until saved, then round-trips', async () => {
    expect(await repo.getSettings()).toBeUndefined();
    await repo.saveSettings(SETTINGS);
    expect(await repo.getSettings()).toEqual(SETTINGS);
  });
});

describe('repo: workouts', () => {
  it('saves a whole session and lists sessions newest first', async () => {
    await repo.saveWorkout(WORKOUT('w1', 1000));
    await repo.saveWorkout(WORKOUT('w2', 2000));
    expect((await repo.listWorkouts()).map((w) => w.id)).toEqual(['w2', 'w1']);
  });

  it('saving the same id replaces the whole session (last write wins)', async () => {
    await repo.saveWorkout(WORKOUT('w1', 1000));
    const edited = WORKOUT('w1', 1000);
    edited.entries[0].sets[0].r = 6;
    await repo.saveWorkout(edited);
    const [only] = await repo.listWorkouts();
    expect(only.entries[0].sets[0].r).toBe(6);
    expect((await repo.listWorkouts()).length).toBe(1);
  });
});

describe('repo: bodyweight', () => {
  it('logs and lists entries by date, newest first', async () => {
    await repo.addBodyweight('2026-11-01', 82.5);
    await repo.addBodyweight('2026-11-03', 82.1);
    expect(await repo.listBodyweight()).toEqual([
      { date: '2026-11-03', kg: 82.1 },
      { date: '2026-11-01', kg: 82.5 },
    ]);
  });
});
