// The latest muscle ranks on this device, for the difficulty lock (owner decision 2026-11-07). Progress writes them on
// every load; plans, swaps and the AI read them without recomputing history. Derived data, so a missing or blocked
// store just means "all F" until the next load.
import type { Exercise } from '../../domain/exercise';
import { blockedIds } from '../../domain/profile';
import type { Settings } from '../../domain/types';
import type { Group } from '../xp/domain/muscles';
import type { Rank } from '../xp/domain/rank';

const KEY = 'muscleRanks';

export function readRanks(): Partial<Record<Group, Rank>> {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? '{}') as unknown;
    return v && typeof v === 'object' ? (v as Partial<Record<Group, Rank>>) : {};
  } catch {
    return {};
  }
}

export function saveRanks(ranks: Partial<Record<Group, Rank>>): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(ranks));
  } catch {
    // Not stored: the lock uses F for every muscle until it can be.
  }
}

// blockedIds with this device's ranks.
export function blockedFor(s: Settings, catalogue: readonly Exercise[]): Set<string> {
  return blockedIds(s, catalogue, readRanks());
}
