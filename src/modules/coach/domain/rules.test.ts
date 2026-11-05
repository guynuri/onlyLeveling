import { describe, it, expect } from 'vitest';
import { detectStale, detectStall, detectTooEasy, missedSessions } from './rules';
import type { HistorySession } from '../../../domain/progression';
import type { SetRow } from '../../../domain/session';

const DAY = 86_400_000;
const NOW = 100 * DAY;
const target = { w: 10, reps: 8, sets: 1 };
const set = (w: number, r: number, rir?: number, phase: 'work' | 'warmup' = 'work'): SetRow => ({
  w,
  r,
  done: true,
  rir,
  phase,
  at: 0,
});
const session = (daysAgo: number, sets: SetRow[], t = target): HistorySession => ({
  date: NOW - daysAgo * DAY,
  target: t,
  sets,
});

describe('stall', () => {
  it('fires when nothing in the last 14 days beat the earlier best', () => {
    const hist = [session(40, [set(10, 8)]), session(20, [set(10, 8)]), session(10, [set(10, 8)]), session(3, [set(10, 7)])];
    expect(detectStall(hist, NOW)).not.toBeNull();
  });
  it('does not fire when a recent session beat the earlier best', () => {
    const hist = [session(40, [set(10, 8)]), session(10, [set(12, 8)]), session(3, [set(10, 8)])];
    expect(detectStall(hist, NOW)).toBeNull();
  });
  it('needs at least two sessions inside the window', () => {
    const hist = [session(40, [set(10, 8)]), session(3, [set(10, 8)])];
    expect(detectStall(hist, NOW)).toBeNull();
  });
  it('needs at least one scored session before the window', () => {
    const hist = [session(10, [set(10, 8)]), session(3, [set(10, 8)])];
    expect(detectStall(hist, NOW)).toBeNull();
  });
});

describe('too easy', () => {
  const top = { w: 10, reps: 12, sets: 1 };
  it('fires after two sessions in a row at the top with RIR 3+', () => {
    const hist = [session(14, [set(10, 12, 3)], top), session(7, [set(10, 12, 4)], top)];
    expect(detectTooEasy(hist, 12)).toBe(true);
  });
  it('does not fire on one session', () => {
    expect(detectTooEasy([session(7, [set(10, 12, 3)], top)], 12)).toBe(false);
  });
  it('does not fire when RIR was not logged', () => {
    const hist = [session(14, [set(10, 12, 3)], top), session(7, [set(10, 12)], top)];
    expect(detectTooEasy(hist, 12)).toBe(false);
  });
  it('does not fire below the top of the range', () => {
    const hist = [session(14, [set(10, 10, 3)]), session(7, [set(10, 10, 3)])];
    expect(detectTooEasy(hist, 12)).toBe(false);
  });
});

describe('stale and missed', () => {
  it('stale fires at 8 weeks, not at 7', () => {
    expect(detectStale([session(56, [set(10, 8)])], NOW)).toBe(true);
    expect(detectStale([session(55, [set(10, 8)])], NOW)).toBe(false);
  });
  it('missed counts expected sessions since the last log, not before the plan changed', () => {
    // 2 weeks at 3 days a week since the last log = 6 missed
    expect(missedSessions([session(14, [set(10, 8)])], 0, 3, NOW)).toBe(6);
    // plan changed 1 day ago, so only that day counts: less than one expected session
    expect(missedSessions([session(14, [set(10, 8)])], NOW - DAY, 3, NOW)).toBe(0);
  });
});
