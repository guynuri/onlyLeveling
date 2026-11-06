import { describe, it, expect } from 'vitest';
import { lastClosedWeekStart, sessionsIn, buildFacts } from './review';
import type { Workout } from '../../../domain/types';

// Wednesday 11 Nov 2026, local. The closed week is the one that started Monday 2 Nov.
const NOW = new Date(2026, 10, 11, 20);

const at = (y: number, m: number, d: number, h = 10) => new Date(y, m - 1, d, h).getTime();
const w = (start: number): Workout => ({ id: `w${start}`, start, end: start + 3_600_000, entries: [] });

describe('the closed week', () => {
  it('is the Monday before this week, never this week', () => {
    expect(lastClosedWeekStart(NOW)).toBe('2026-11-02');
  });

  it('on a Monday, the week that just ended is the one before', () => {
    expect(lastClosedWeekStart(new Date(2026, 10, 9, 8))).toBe('2026-11-02');
  });

  it('on a Sunday, the closed week is still the one before this week', () => {
    expect(lastClosedWeekStart(new Date(2026, 10, 8, 23))).toBe('2026-10-26');
  });
});

describe('the facts', () => {
  it('counts only the sessions inside the closed week, local time', () => {
    const ws = [w(at(2026, 11, 2)), w(at(2026, 11, 4)), w(at(2026, 11, 8, 23)), w(at(2026, 11, 9, 8))];
    expect(sessionsIn('2026-11-02', ws)).toBe(3); // Sunday 23:00 counts; Monday 9 Nov is the next week
  });

  it('builds the numbers the review uses, and nothing else', () => {
    const f = buildFacts({ week: '2026-11-02', workouts: [w(at(2026, 11, 3))], daysPerWeek: 3, streakWeeks: 2, pendingSuggestions: 1 });
    expect(f).toEqual({ week: '2026-11-02', sessionsDone: 1, sessionsPlanned: 3, streakWeeks: 2, openSwaps: 1 });
  });
});
