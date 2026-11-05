// App-side glue for the training screens: one database handle, the repos, default settings, history shaping.
import { openAppDb, type Db } from '../../db/idb';
import { createRepo } from '../../data/idb-repo';
import type { Repo } from '../../data/repo';
import { createOutbox, type Outbox } from '../../data/outbox';
import { createSyncedRepo } from '../../data/synced-repo';
import { TRAINING, TEMPLATE } from '../../config/thresholds';
import type { Exercise } from '../../domain/exercise';
import type { HistorySession, ProgressionConfig } from '../../domain/progression';
import type { Settings, Workout } from '../../domain/types';
import { planFromTemplate, planIsCurrent, type Plan } from '../../domain/plan';
import { buildTemplate } from '../../domain/template';
import { listExercises } from '../../data/exercises';

// Caches one open handle. A failed open is not cached, so the next call retries. reset() drops the handle,
// for when another tab upgrades the database and this connection is closed.
export function createRepoCache<T>(open: () => Promise<T>): { get(): Promise<T>; reset(): void } {
  let pending: Promise<T> | null = null;
  return {
    get() {
      pending ??= open().catch((e: unknown) => {
        pending = null;
        throw e;
      });
      return pending;
    },
    reset() {
      pending = null;
    },
  };
}

const dbCache = createRepoCache<Db>(() => openAppDb(undefined, { onVersionChange: () => dbCache.reset() }));

export function getDb(): Promise<Db> {
  return dbCache.get();
}

// Local repo: applying server data goes here, so it is not queued again.
export async function getLocalRepo(): Promise<Repo> {
  return createRepo(await getDb());
}

export async function getOutbox(): Promise<Outbox> {
  return createOutbox(await getDb());
}

// What the screens use: every write is saved locally and queued for the server.
export async function getRepo(): Promise<Repo> {
  const db = await getDb();
  return createSyncedRepo(createRepo(db), createOutbox(db));
}

// The saved plan. Built from the rules once, then kept as is: it is rebuilt only when days per week changes.
// Accepted coach suggestions edit it (coach/actions.ts). Never rebuilt on every open.
// A plan built here is derived from settings, so it is saved locally only and never queued for the server:
// a new device must not push its default over the plan already on the server.
export async function currentPlan(repo: Repo, local: Repo, s: Settings, now = Date.now()): Promise<Plan> {
  const saved = await repo.getPlan();
  if (saved && planIsCurrent(saved, s.daysPerWeek)) return saved;
  const t = buildTemplate({
    daysPerWeek: s.daysPerWeek,
    exercisesPerDay: TEMPLATE.exercisesPerDay,
    avoid: [],
    catalogue: listExercises(),
  });
  const plan = planFromTemplate(t.days, s.daysPerWeek, now);
  await local.savePlan(plan);
  return plan;
}

export function defaultSettings(): Settings {
  return {
    daysPerWeek: TRAINING.defaultDaysPerWeek,
    restSec: TRAINING.restSec,
    owned: [...TRAINING.defaultOwnedKg],
  };
}

import { repRangeFor } from '../../domain/reps';
export { repRangeFor };

export function progressionConfigFor(ex: Exercise, owned: number[]): ProgressionConfig {
  const range = repRangeFor(ex);
  return {
    repMin: range.min,
    repMax: range.max,
    sets: TRAINING.defaultSets,
    owned,
    gridStep: TRAINING.gridStepKg,
    startWeight: TRAINING.startWeightKg,
  };
}

// Finished sessions that contain this exercise, oldest first, shaped for progression.
export function historyFor(workouts: readonly Workout[], exerciseId: string): HistorySession[] {
  return workouts
    .flatMap((w) =>
      w.entries
        .filter((e) => e.exerciseId === exerciseId)
        .map((e) => ({ date: w.start, target: e.planned, sets: e.sets })),
    )
    .sort((a, b) => a.date - b.date);
}
