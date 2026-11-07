// The latest muscle ranks on this device, for the difficulty lock (owner decision 2026-11-07). Progress writes them on
// every load; plans, swaps and the AI read them without recomputing history. Derived data, so a missing or blocked
// store just means the lock waits until the next load.
import type { Exercise } from '../../domain/exercise';
import { blockedIds } from '../../domain/profile';
import type { Settings } from '../../domain/types';
import type { Group } from '../xp/domain/muscles';
import type { Rank } from '../xp/domain/rank';

const KEY = 'muscleRanks';

// Null until Progress or Home has run once on this device.
export function readRanks(): Partial<Record<Group, Rank>> | null {
  try {
    const raw = localStorage.getItem(KEY);
    const v = raw ? (JSON.parse(raw) as unknown) : null;
    return v && typeof v === 'object' ? (v as Partial<Record<Group, Rank>>) : null;
  } catch {
    return null;
  }
}

export function saveRanks(ranks: Partial<Record<Group, Rank>>): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(ranks));
  } catch {
    // Not stored: the lock waits until it can be.
  }
}

// blockedIds with this device's ranks. With no ranks known yet the lock waits, rather than locking everything (a new
// phone would otherwise build a beginner-only plan before its history is read).
export function blockedFor(s: Settings, catalogue: readonly Exercise[]): Set<string> {
  return blockedIds(s, catalogue, readRanks());
}
