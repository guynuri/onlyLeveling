// App-side glue for the training screens: one database handle, the repos, default settings, history shaping.
import { openAppDb, type Db } from '../../db/idb';
import { createRepo } from '../../data/idb-repo';
import type { Repo } from '../../data/repo';
import { createOutbox, type Outbox } from '../../data/outbox';
import { createSyncedRepo } from '../../data/synced-repo';
import { BLOCK, TRAINING } from '../../config/thresholds';
import type { Exercise } from '../../domain/exercise';
import type { HistorySession, ProgressionConfig } from '../../domain/progression';
import type { Settings, Workout } from '../../domain/types';
import { planFromTemplate, type Plan } from '../../domain/plan';
import { buildRulesPlan } from '../../domain/plan-builder';
import { listExercises } from '../../data/exercises';

import { loadKind } from '../../domain/exercise';
import type { Target } from '../../domain/template';

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

// The saved plan. Built from the rules once (an 8-week block), then kept exactly as saved: the user and the coach edit
// it, so a change to days per week never replaces it (the Plan screen offers to regenerate instead).
// A plan built here is derived from settings, so it is saved locally only and never queued for the server:
// a new device must not push its default over the plan already on the server.
// When nothing the user owns fits, an empty plan is returned and nothing is saved.
export async function currentPlan(repo: Repo, local: Repo, s: Settings, now = Date.now()): Promise<Plan> {
  const saved = await repo.getPlan();
  if (saved) return saved;
  const built = buildRulesPlan({ settings: s, catalogue: listExercises(), kind: 'auto', weeks: BLOCK.defaultWeeks, now });
  if (!built.ok) return planFromTemplate([], s.daysPerWeek, now);
  await local.savePlan(built.plan);
  return built.plan;
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

// Dumbbell moves snap to owned dumbbells, kettlebell moves to owned kettlebells; bands and bodyweight go by reps only.
export function progressionConfigFor(ex: Exercise, s: Settings, target?: Target): ProgressionConfig {
  const range = target ? { min: target.repMin, max: target.repMax } : repRangeFor(ex);
  const kind = loadKind(ex);
  const owned = kind === 'dumbbell' ? s.owned : kind === 'kettlebell' ? (s.ownedKettlebells ?? []) : [];
  return {
    repMin: range.min,
    repMax: range.max,
    sets: target?.sets ?? TRAINING.defaultSets,
    owned,
    gridStep: TRAINING.gridStepKg,
    startWeight: TRAINING.startWeightKg,
    weighted: kind !== 'none',
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
