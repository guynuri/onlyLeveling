// App-side glue for the training screens: one repo handle, default settings, history shaping.
import { openAppDb } from '../../db/idb';
import { createRepo } from '../../data/idb-repo';
import type { Repo } from '../../data/repo';
import { TRAINING, REP_RANGES } from '../../config/thresholds';
import type { Exercise } from '../../domain/exercise';
import type { HistorySession, ProgressionConfig } from '../../domain/progression';
import type { Settings, Workout } from '../../domain/types';

// One shared handle. If another tab upgrades the database, this connection is closed: drop the handle so
// the next call reopens it on the current schema.
let repoPromise: Promise<Repo> | null = null;
export function getRepo(): Promise<Repo> {
  repoPromise ??= openAppDb(undefined, {
    onVersionChange: () => {
      repoPromise = null;
    },
  }).then(createRepo);
  return repoPromise;
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
