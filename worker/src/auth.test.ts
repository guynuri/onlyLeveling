import { describe, it, expect, beforeEach } from 'vitest';
import { env } from 'cloudflare:test';
import { authenticate, bearerToken } from './auth';
import { signIn, createInvite } from './auth/accounts';
import { hashPassword } from './auth/password';
import type { Env } from './env';

const SECRET = 'correct-horse-battery-staple';
const db = (env as unknown as Env).DB;
const NOW = 3_000_000_000_000;
const PW = 'a long enough password';

const req = (headers: Record<string, string>) => new Request('https://api.example/x', { headers });
const envFor = (bootstrap: string) => ({ DB: db, BOOTSTRAP_TOKEN: bootstrap });

beforeEach(async () => {
  for (const t of ['sessions', 'invites', 'passwords', 'users']) {
    await db.prepare(`DELETE FROM ${t}`).run();
  }
});

describe('bearerToken', () => {
  it('reads the Authorization: Bearer header', () => {
    expect(bearerToken(req({ Authorization: `Bearer ${SECRET}` }))).toBe(SECRET);
  });

  it('is null without the header or with another scheme', () => {
    expect(bearerToken(req({}))).toBeNull();
    expect(bearerToken(req({ Authorization: `Basic ${SECRET}` }))).toBeNull();
  });
});

describe('authenticate', () => {
  it('the owner key still authenticates the bootstrap user (the Phase 4a data stays reachable)', async () => {
    expect(await authenticate(req({ Authorization: `Bearer ${SECRET}` }), envFor(SECRET), NOW)).toEqual({
      userId: 'u_bootstrap',
    });
  });

  it('a session from sign-in authenticates its own user', async () => {
    await db.prepare('INSERT INTO users (id, username, created_at) VALUES (?, ?, ?)').bind('u_s1', 'sess_one', NOW).run();
    const stored = await hashPassword(PW);
    await db
      .prepare('INSERT INTO passwords (user_id, hash, salt, iterations, updated_at) VALUES (?, ?, ?, ?, ?)')
      .bind('u_s1', stored.hash, stored.salt, stored.iterations, NOW)
      .run();
    const { token } = await signIn(db, { username: 'sess_one', password: PW }, NOW);
    expect(await authenticate(req({ Authorization: `Bearer ${token}` }), envFor(SECRET), NOW)).toEqual({
      userId: 'u_s1',
    });
  });

  it('an unknown or wrong token is rejected', async () => {
    expect(await authenticate(req({ Authorization: 'Bearer nope' }), envFor(SECRET), NOW)).toBeNull();
    expect(await authenticate(req({}), envFor(SECRET), NOW)).toBeNull();
  });

  it('an empty configured secret never authenticates anyone', async () => {
    expect(await authenticate(req({ Authorization: 'Bearer ' }), envFor(''), NOW)).toBeNull();
  });

  it('a cookie alone never authenticates (auth is the bearer header only)', async () => {
    expect(await authenticate(req({ Cookie: `session=${SECRET}` }), envFor(SECRET), NOW)).toBeNull();
  });

  it('an invite code is not a session token', async () => {
    const code = await createInvite(db, 'u_bootstrap', NOW);
    expect(await authenticate(req({ Authorization: `Bearer ${code}` }), envFor(SECRET), NOW)).toBeNull();
  });
});
