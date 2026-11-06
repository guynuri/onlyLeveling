// Reminder timing in the user's own time zone (PLAN Phase 9). Pure: the caller passes the clock and the zone.
import { PUSH } from '../config';
// The week runs Monday to Sunday in that zone. A reminder is due at the set minute, once per local day, and only while
// the week's finished sessions are below days per week.

export interface LocalParts {
  day: string; // YYYY-MM-DD in the zone
  hm: string; // HH:MM in the zone
}

export function localParts(nowMs: number, tz: string): LocalParts {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(nowMs));
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  return { day: `${get('year')}-${get('month')}-${get('day')}`, hm: `${get('hour')}:${get('minute')}` };
}

// Monday of the week containing `day` (YYYY-MM-DD). Date arithmetic in UTC, so it is not shifted by DST.
export function weekStartDay(day: string): string {
  const [y, m, d] = day.split('-').map(Number);
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0 = Sunday
  const monday = new Date(Date.UTC(y, m - 1, d - ((dow + 6) % 7)));
  return monday.toISOString().slice(0, 10);
}

// Finished sessions from Monday up to and including today, in the zone.
export function sessionsThisWeek(starts: readonly number[], tz: string, nowMs: number): number {
  const today = localParts(nowMs, tz).day;
  const monday = weekStartDay(today);
  return starts.filter((t) => {
    const day = localParts(t, tz).day;
    return day >= monday && day <= today;
  }).length;
}

// Due from the set minute for the reminder window, once per local day. A cron run that starts a few minutes late
// still sends; a run after the window does not (so a reminder never arrives hours late).
export function reminderDue(r: { time: string; tz: string; lastSentDay: string | null }, nowMs: number): boolean {
  const now = localParts(nowMs, r.tz);
  if (now.day === r.lastSentDay) return false;
  const late = minutesOf(now.hm) - minutesOf(r.time);
  return late >= 0 && late < PUSH.reminderWindowMin;
}

function minutesOf(hm: string): number {
  const [h, m] = hm.split(':').map(Number);
  return h * 60 + m;
}

// Remind while this week's count is short of the plan.
export function shouldRemind(finishedThisWeek: number, daysPerWeek: number): boolean {
  return finishedThisWeek < daysPerWeek;
}

// A valid IANA zone name, or false. Intl throws on unknown names.
export function validTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat('en', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}
