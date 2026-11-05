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

function previousWeek(weekStartMs: number): number {
  const d = new Date(weekStartMs);
  d.setDate(d.getDate() - 7);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

// Number of consecutive counted weeks, ending at the current week (or the last closed week).
export function streakWeeks(sessionStarts: readonly number[], daysPerWeek: number, now: number): number {
  if (sessionStarts.length === 0 || daysPerWeek <= 0) return 0;
  const perWeek = new Map<number, number>();
  for (const t of sessionStarts) {
    const w = weekStart(t);
    perWeek.set(w, (perWeek.get(w) ?? 0) + 1);
  }
  const first = Math.min(...perWeek.keys());
  const current = weekStart(now);
  let streak = 0;
  for (let w = current; w >= first; w = previousWeek(w)) {
    const done = (perWeek.get(w) ?? 0) >= daysPerWeek;
    if (done) streak++;
    else if (w !== current) break; // a closed week that fell short resets the streak
  }
  return streak;
}
