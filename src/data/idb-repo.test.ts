import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { openAppDb, type Db } from '../db/idb';
import { createRepo } from './idb-repo';
import type { Repo } from './repo';
import type { Settings, Workout } from '../domain/types';
import type { CardioSession } from '../domain/cardio';

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

describe('cardio sessions', () => {
  const C = (id: string, start: number): CardioSession => ({ id, start, minutes: 30, type: 'run' });
  it('saves and lists them newest first, and a second save of the same id replaces it', async () => {
    await repo.saveCardio(C('c1', 100));
    await repo.saveCardio(C('c2', 300));
    await repo.saveCardio({ ...C('c1', 100), minutes: 45 });
    const all = await repo.listCardio();
    expect(all.map((c) => c.id)).toEqual(['c2', 'c1']);
    expect(all[1].minutes).toBe(45);
  });
});

describe('game records (U7)', () => {
  it('keeps the first write for a key', async () => {
    expect(await repo.putGame({ key: 'quests:2026-11-02', data: [1], at: 1 })).toBe(true);
    expect(await repo.putGame({ key: 'quests:2026-11-02', data: [2], at: 2 })).toBe(false);
    expect(await repo.listGame()).toEqual([{ key: 'quests:2026-11-02', data: [1], at: 1 }]);
    // The server's copy (pull) replaces it.
    await repo.putGame({ key: 'quests:2026-11-02', data: [3], at: 3 }, true);
    expect((await repo.listGame())[0].data).toEqual([3]);
  });
});
