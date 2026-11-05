// Rest timer on a wall-clock endsAt (SPEC §3.2). Pure: the screen reads Date.now() and calls remainingMs.
export interface RestTimer {
  endsAt: number; // epoch ms
  holdActive: boolean; // a hold running now; starting a rest abandons it
}

// A new rest. restSec 0 (or less) means the timer is off: null. A rest always clears any running hold,
// so the result never has holdActive set; the caller replaces its previous timer with this one.
export function startRest(now: number, restSec: number): RestTimer | null {
  if (!(restSec > 0)) return null;
  return { endsAt: now + restSec * 1000, holdActive: false };
}

// Milliseconds left. Reads the clock, so a backgrounded page that resumes after endsAt shows 0 at once.
export function remainingMs(timer: Pick<RestTimer, 'endsAt'>, now: number): number {
  return Math.max(0, timer.endsAt - now);
}
