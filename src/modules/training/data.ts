// App-side glue for the training screens: one repo handle, default settings, history shaping.
import { openAppDb } from '../../db/idb';
import { createRepo } from '../../data/idb-repo';
import type { Repo } from '../../data/repo';
import { TRAINING, REP_RANGES } from '../../config/thresholds';
import type { Exercise } from '../../domain/exercise';
import type { HistorySession, ProgressionConfig } from '../../domain/progression';
import type { Settings, Workout } from '../../domain/types';

// Caches one open handle. A failed open is not cached, so the next call retries. reset() drops the handle,
// for when another tab upgrades the database and this connection is closed.
export function createRepoCache(open: () => Promise<Repo>): { get(): Promise<Repo>; reset(): void } {
  let pending: Promise<Repo> | null = null;
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

const cache = createRepoCache(() =>
  openAppDb(undefined, { onVersionChange: () => cache.reset() }).then(createRepo),
);

export function getRepo(): Promise<Repo> {
  return cache.get();
}

export function defaultSettings(): Settings {
  return {
    daysPerWeek: TRAINING.defaultDaysPerWeek,
    restSec: TRAINING.restSec,
    owned: [...TRAINING.defaultOwnedKg],
  };
}

// Rep range by exercise type (SPEC §3.1). Mechanic unknown is treated as isolation (PLAN D10).
export function repRangeFor(ex: Exercise): { min: number; max: number } {
  return ex.mechanic === 'compound' ? REP_RANGES.compound : REP_RANGES.isolation;
}

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
