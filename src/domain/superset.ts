// Supersets (owner decision 2026-11-07: groups of 2 to 3). A superset is a run of adjacent exercises in a day that are
// done one set each in turn, with the rest only after the last one of the round. Stored on the day as lists of ids;
// readers always go through supersetsOf, which drops anything stale (moved apart, removed, too small or too big).
// Pure.
import { SUPERSET } from '../config/thresholds';
import type { TemplateDay } from './template';

type Day = Pick<TemplateDay, 'exerciseIds' | 'supersets'>;

// Valid groups only, in day order: members present, adjacent, in day order, size within limits, no overlap.
export function supersetsOf(day: Day): string[][] {
  const used = new Set<string>();
  const out: string[][] = [];
  for (const g of day.supersets ?? []) {
    const at = g.map((id) => day.exerciseIds.indexOf(id));
    const ok =
      g.length >= SUPERSET.minSize &&
      g.length <= SUPERSET.maxSize &&
      at.every((i, k) => i !== -1 && (k === 0 || i === at[k - 1] + 1)) &&
      g.every((id) => !used.has(id));
    if (!ok) continue;
    g.forEach((id) => used.add(id));
    out.push([...g]);
  }
  return out.sort((a, b) => day.exerciseIds.indexOf(a[0]) - day.exerciseIds.indexOf(b[0]));
}

export function groupOf(day: Day, id: string): string[] | null {
  return supersetsOf(day).find((g) => g.includes(id)) ?? null;
}

// A letter per group (A, B, ...) in day order, for labels like A1 / A2.
export function supersetLabel(day: Day, id: string): string | null {
  const groups = supersetsOf(day);
  const gi = groups.findIndex((g) => g.includes(id));
  return gi === -1 ? null : `${String.fromCharCode(65 + gi)}${groups[gi].indexOf(id) + 1}`;
}

// Joins `id` (or its group) with the next exercise (or its group). Returns the same supersets when the result would be
// too big or there is no next exercise.
export function linkNext(day: Day, id: string): string[][] {
  const groups = supersetsOf(day);
  const mine = groups.find((g) => g.includes(id)) ?? [id];
  const nextId = day.exerciseIds[day.exerciseIds.indexOf(mine[mine.length - 1]) + 1];
  if (nextId === undefined) return groups;
  const theirs = groups.find((g) => g.includes(nextId)) ?? [nextId];
  const merged = [...mine, ...theirs];
  if (merged.length > SUPERSET.maxSize) return groups;
  return supersetsOf({ ...day, supersets: [...groups.filter((g) => g !== mine && g !== theirs), merged] });
}

// Takes `id` out of its group; a group left with one exercise is dissolved. Taking out a middle member splits it.
export function unlink(day: Day, id: string): string[][] {
  const groups = supersetsOf(day);
  return groups.flatMap((g) => {
    const i = g.indexOf(id);
    return i === -1 ? [g] : [g.slice(0, i), g.slice(i + 1)].filter((part) => part.length >= SUPERSET.minSize);
  });
}

// After logging a set of `id`: the next member of its group with sets left in this round (no rest), or, at the end of
// the round, rest and go back to the first member with sets left. `left(id)` is how many sets that exercise still has.
// Not in a group: rest, no change of exercise.
export function afterSet(day: Day, id: string, left: (id: string) => number): { rest: boolean; next: string | null } {
  const g = groupOf(day, id);
  if (!g) return { rest: true, next: null };
  const later = g.slice(g.indexOf(id) + 1).find((m) => left(m) > 0);
  if (later) return { rest: false, next: later };
  return { rest: true, next: g.find((m) => left(m) > 0) ?? null };
}
