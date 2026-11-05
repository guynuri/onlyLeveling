import { describe, it, expect } from 'vitest';
import { streakWeeks, weekStart } from './streak';

// Wednesday 11 Nov 2026, evening. Its week starts Monday 9 Nov, local time.
const NOW = new Date(2026, 10, 11, 20).getTime();
// A session `weeksAgo` weeks before the current week, on `dayOffset` days from its Monday, at 10:00 local.
const at = (weeksAgo: number, dayOffset: number) => new Date(2026, 10, 9 - 7 * weeksAgo + dayOffset, 10).getTime();

describe('weekly streak', () => {
  it('three of three in each closed week counts; an open current week does not break it', () => {
    const sessions = [0, 2, 4].flatMap((d) => [at(1, d), at(2, d), at(3, d)]);
    expect(streakWeeks(sessions, 3, NOW)).toBe(3);
  });

  it('a closed week with a missed session resets the streak', () => {
    const sessions = [at(1, 0), at(1, 2), at(1, 4), at(2, 0), at(2, 2), at(3, 0), at(3, 2), at(3, 4)];
    expect(streakWeeks(sessions, 3, NOW)).toBe(1);
  });

  it('the current week counts once all planned sessions are done', () => {
    expect(streakWeeks([at(0, 0), at(0, 1), at(0, 2)], 3, NOW)).toBe(1);
  });

  it('no sessions, no streak', () => {
    expect(streakWeeks([], 3, NOW)).toBe(0);
  });

  it('weeks start on local Monday midnight, including the week of a DST change', () => {
    for (const d of [new Date(2026, 2, 8, 12), new Date(2026, 9, 25, 12)]) {
      const start = new Date(weekStart(d.getTime()));
      expect(start.getDay()).toBe(1);
      expect(start.getHours()).toBe(0);
      expect(start.getMinutes()).toBe(0);
    }
  });
});
