// How long a day's lifting takes (owner decision 2026-11-17). Shared by the app (rules plan, plan preview) and the
// Worker (AI plan check). An estimate for planning only: the athlete runs the session as they like. Pure.
import { SESSION_TIME } from '../src/config/thresholds';

export interface TimedItem {
  id: string;
  sets: number;
  reps: number; // seconds for a timed hold
  timed?: boolean; // a hold: `reps` is seconds
  unilateral?: boolean; // one side at a time: every set is done twice
}

// One set's work, in seconds.
export function workSeconds(i: Pick<TimedItem, 'reps' | 'timed' | 'unilateral'>): number {
  const once = i.timed ? i.reps : i.reps * SESSION_TIME.secondsPerRep;
  return Math.max(0, once) * (i.unilateral ? 2 : 1);
}

// A day's lifting time in seconds: each exercise is its sets, the rest between them, and one changeover. A superset
// runs its members in rounds (one set each, a short switch between them) with one rest after each round but the last,
// and one changeover for the whole group. `supersets` lists groups of ids; members missing from `items` are ignored.
export function daySeconds(items: readonly TimedItem[], supersets: readonly (readonly string[])[], restSec: number): number {
  const rest = Math.max(0, restSec);
  const done = new Set<string>();
  let total = 0;
  for (const item of items) {
    if (done.has(item.id)) continue;
    const group = supersets.find((g) => g.includes(item.id));
    const members = group ? items.filter((i) => group.includes(i.id)) : [];
    if (members.length >= 2) {
      const rounds = Math.max(...members.map((m) => m.sets));
      for (let r = 0; r < rounds; r++) {
        const inRound = members.filter((m) => m.sets > r);
        total += inRound.reduce((sum, m) => sum + workSeconds(m), 0) + (inRound.length - 1) * SESSION_TIME.supersetSwitchSec;
      }
      total += (rounds - 1) * rest + SESSION_TIME.changeoverSec;
      members.forEach((m) => done.add(m.id));
    } else {
      total += item.sets * workSeconds(item) + Math.max(0, item.sets - 1) * rest + SESSION_TIME.changeoverSec;
      done.add(item.id);
    }
  }
  return total;
}

// Whole minutes, rounded up, for display ("≈ 44 min").
export const minutesOf = (seconds: number): number => Math.ceil(seconds / 60);

// Drops exercises from the end of a day until it fits `budgetSec`: the last one `keep` does not protect first, then the
// last one of all. Never below `min` exercises. Returns what is kept (in order) and what was dropped. Pure.
export function trimToBudget<T extends TimedItem>(
  items: readonly T[],
  supersets: readonly (readonly string[])[],
  restSec: number,
  budgetSec: number,
  keep: (t: T) => boolean,
  min: number,
): { kept: T[]; dropped: T[] } {
  const kept = [...items];
  const dropped: T[] = [];
  while (kept.length > min && daySeconds(kept, supersets, restSec) > budgetSec) {
    let at = -1;
    for (let i = kept.length - 1; i >= 0; i--) {
      if (!keep(kept[i])) {
        at = i;
        break;
      }
    }
    if (at === -1) at = kept.length - 1;
    dropped.push(...kept.splice(at, 1));
  }
  return { kept, dropped };
}
