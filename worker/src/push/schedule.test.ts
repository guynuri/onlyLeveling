import { describe, it, expect } from 'vitest';
import { localParts, reminderDue, sessionsThisWeek, shouldRemind, validTimeZone, weekStartDay } from './schedule';

// Times below are written in UTC; the zone decides the local day and minute.
const at = (iso: string) => Date.parse(iso);

describe('local time', () => {
  it('reads the day and minute in the user’s zone, not UTC', () => {
    // 21:30 UTC on 5 Nov 2026 is 23:30 in Jerusalem (UTC+2 in November)
    expect(localParts(at('2026-11-05T21:30:00Z'), 'Asia/Jerusalem')).toEqual({ day: '2026-11-05', hm: '23:30' });
    // The same instant in New York (UTC-5) is still the 5th, at 16:30
    expect(localParts(at('2026-11-05T21:30:00Z'), 'America/New_York')).toEqual({ day: '2026-11-05', hm: '16:30' });
  });

  it('rejects unknown zones', () => {
    expect(validTimeZone('Asia/Jerusalem')).toBe(true);
    expect(validTimeZone('Mars/Olympus')).toBe(false);
  });
});

describe('the week', () => {
  it('starts on Monday: Sunday belongs to the week before', () => {
    expect(weekStartDay('2026-11-08')).toBe('2026-11-02'); // Sunday → the Monday before
    expect(weekStartDay('2026-11-09')).toBe('2026-11-09'); // Monday → itself
  });

  it('counts finished sessions from Monday up to today, in the zone', () => {
    // Zone Asia/Jerusalem. Sunday 8 Nov 23:00 local is the previous week; Monday 9 Nov 10:00 is this week.
    const starts = [
      at('2026-11-08T21:00:00Z'), // Sunday 23:00 local: last week
      at('2026-11-09T08:00:00Z'), // Monday 10:00 local: this week
      at('2026-11-10T08:00:00Z'), // Tuesday: this week
    ];
    expect(sessionsThisWeek(starts, 'Asia/Jerusalem', at('2026-11-10T12:00:00Z'))).toBe(2);
  });
});

describe('reminder rule', () => {
  const r = { time: '18:00', tz: 'Asia/Jerusalem', lastSentDay: null as string | null };

  it('is due from the set minute for the window, once per local day', () => {
    expect(reminderDue(r, at('2026-11-05T16:00:00Z'))).toBe(true); // 18:00 local
    expect(reminderDue(r, at('2026-11-05T16:01:00Z'))).toBe(true); // 18:01: a late cron run still sends
    expect(reminderDue(r, at('2026-11-05T16:29:00Z'))).toBe(true); // 18:29: still inside the window
    expect(reminderDue(r, at('2026-11-05T16:30:00Z'))).toBe(false); // 18:30: window over
    expect(reminderDue(r, at('2026-11-05T15:59:00Z'))).toBe(false); // 17:59: too early
    expect(reminderDue({ ...r, lastSentDay: '2026-11-05' }, at('2026-11-05T16:00:00Z'))).toBe(false);
  });

  it('is not due at the wrong minute in a different zone', () => {
    expect(reminderDue({ ...r, tz: 'America/New_York' }, at('2026-11-05T16:00:00Z'))).toBe(false);
  });

  it('remind only while the week’s sessions are short of the plan', () => {
    expect(shouldRemind(2, 3)).toBe(true);
    expect(shouldRemind(3, 3)).toBe(false);
    expect(shouldRemind(4, 3)).toBe(false);
  });
});
