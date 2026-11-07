import { GAME } from '../../../config/thresholds';
// Weekly streak (SPEC §4b, PLAN Phase 6). A week runs Monday 00:00 to Sunday 23:59 in local time. A week counts when
// every planned session (daysPerWeek) was finished. A past week that did not count resets the streak. The current
// week does not break the streak while it is still open. Pure: callers pass the clock.
// Local-time arithmetic uses Date setters (not +7×24h), so a DST change does not shift the week boundary.

export function weekStart(ms: number): number {
  const d = new Date(ms);
  const offset = (d.getDay() + 6) % 7; // Monday = 0
  d.setDate(d.getDate() - offset);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function nextWeek(ms: number): number {
  const d = new Date(ms);
  d.setDate(d.getDate() + 7);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

// Weekly streak with freezes. A completed week adds to the streak and, every freezeEveryWeeks completed weeks, earns a
// freeze (max freezeMax). A missed closed week spends a freeze if the streak is running, else resets it. The open
// current week counts once it is complete and never breaks the streak.
export function streakWithFreezes(slotStarts: readonly number[], daysPerWeek: number, now: number): { streak: number; freezes: number; frozen: number } {
  if (slotStarts.length === 0 || daysPerWeek <= 0) return { streak: 0, freezes: 0, frozen: 0 };
  const perWeek = new Map<number, number>();
  for (const t of slotStarts) perWeek.set(weekStart(t), (perWeek.get(weekStart(t)) ?? 0) + 1);
  const current = weekStart(now);
  let streak = 0;
  let freezes = 0;
  let frozen = 0;
  let completed = 0;
  for (let w = Math.min(...perWeek.keys()); w <= current; w = nextWeek(w)) {
    if ((perWeek.get(w) ?? 0) >= daysPerWeek) {
      streak++;
      completed++;
      if (completed % GAME.freezeEveryWeeks === 0) freezes = Math.min(GAME.freezeMax, freezes + 1);
    } else if (w !== current) {
      if (streak > 0 && freezes > 0) {
        freezes--;
        frozen++;
      } else streak = 0;
    }
  }
  return { streak, freezes, frozen };
}
