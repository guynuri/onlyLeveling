import { describe, it, expect } from 'vitest';
import { startRest, remainingMs, type RestTimer } from './rest-timer';

const T0 = 1_000_000;

describe('rest timer (wall-clock endsAt)', () => {
  it('endsAt is now plus the rest in milliseconds', () => {
    const r = startRest(T0, 90);
    expect(r).toEqual({ endsAt: T0 + 90_000, holdActive: false });
  });

  it('remaining time counts down and never goes negative', () => {
    const r = startRest(T0, 90) as RestTimer;
    expect(remainingMs(r, T0)).toBe(90_000);
    expect(remainingMs(r, T0 + 30_000)).toBe(60_000);
    expect(remainingMs(r, T0 + 200_000)).toBe(0);
  });

  it('a backgrounded page catches up: after the rest has elapsed, remaining is 0', () => {
    const r = startRest(T0, 90) as RestTimer;
    // iOS suspended the page for five minutes; the timer reads the clock, so it is already done.
    expect(remainingMs(r, T0 + 5 * 60_000)).toBe(0);
  });

  it('restSec = 0 never starts a rest', () => {
    expect(startRest(T0, 0)).toBeNull();
    expect(startRest(T0, -5)).toBeNull();
  });

  it('starting a rest abandons a running hold: the new timer is a rest, never a hold', () => {
    const r = startRest(T0, 90);
    expect(r?.holdActive).toBe(false);
    expect(r?.endsAt).toBe(T0 + 90_000);
  });
});
