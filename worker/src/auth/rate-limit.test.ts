import { describe, it, expect, beforeEach } from 'vitest';
import { env } from 'cloudflare:test';
import { allowAttempt } from './rate-limit';
import { AUTH } from '../config';
import type { Env } from '../env';

const db = (env as unknown as Env).DB;
const T0 = 2_000_000_000_000;
const WINDOW_MS = AUTH.rateLimit.windowSec * 1000;

beforeEach(async () => {
  await db.prepare('DELETE FROM rate_limits').run();
});

describe('rate limit per action and IP', () => {
  it('allows the configured number of attempts in a window, then refuses', async () => {
    for (let i = 0; i < AUTH.rateLimit.maxAttempts; i++) {
      expect(await allowAttempt(db, 'signin', '1.2.3.4', T0)).toBe(true);
    }
    expect(await allowAttempt(db, 'signin', '1.2.3.4', T0)).toBe(false);
  });

  it('allows again once the window has passed', async () => {
    for (let i = 0; i < AUTH.rateLimit.maxAttempts; i++) await allowAttempt(db, 'signin', '1.2.3.4', T0);
    expect(await allowAttempt(db, 'signin', '1.2.3.4', T0 + WINDOW_MS)).toBe(true);
  });

  it('one IP does not use up another IP’s attempts', async () => {
    for (let i = 0; i < AUTH.rateLimit.maxAttempts; i++) await allowAttempt(db, 'signin', '1.2.3.4', T0);
    expect(await allowAttempt(db, 'signin', '5.6.7.8', T0)).toBe(true);
  });

  it('actions are counted separately', async () => {
    for (let i = 0; i < AUTH.rateLimit.maxAttempts; i++) await allowAttempt(db, 'signin', '1.2.3.4', T0);
    expect(await allowAttempt(db, 'signup', '1.2.3.4', T0)).toBe(true);
  });
});
