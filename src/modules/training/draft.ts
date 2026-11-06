// The workout in progress, kept on this device so a killed iOS PWA does not lose it. Local only: it lives in the
// IndexedDB `meta` store and is never queued for the server. Finish and Discard clear it.
import { WORKOUT } from '../../config/thresholds';
import type { Db } from '../../db/idb';
import type { LiveExercise } from '../../domain/live-session';

export interface Draft {
  dayIndex: number; // which plan day the session was started for
  planUpdatedAt: number; // the plan it was built from; an edited plan makes the draft stale
  startedAt: number;
  exercises: LiveExercise[];
}

const KEY = 'liveSession';

// Only for the same plan day and the same plan, and only while it is recent: an old draft is a forgotten one.
export function isRestorable(d: Draft | undefined, dayIndex: number, planUpdatedAt: number, now: number): boolean {
  return !!d && d.dayIndex === dayIndex && d.planUpdatedAt === planUpdatedAt && now - d.startedAt < WORKOUT.draftMaxHours * 3_600_000;
}

export async function readDraft(db: Db): Promise<Draft | undefined> {
  return (await db.get('meta', KEY)) as Draft | undefined;
}

export async function writeDraft(db: Db, d: Draft): Promise<void> {
  await db.put('meta', d, KEY);
}

export async function clearDraft(db: Db): Promise<void> {
  await db.delete('meta', KEY);
}
