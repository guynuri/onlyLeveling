import { describe, it, expect, beforeEach } from 'vitest';
import { env } from 'cloudflare:test';
import {
  createInvite,
  signUp,
  signIn,
  resolveSession,
  signOut,
  recover,
  ownerSetup,
  AuthError,
} from './accounts';
import { sha256Hex } from './codes';
import type { Env } from '../env';

const db = (env as unknown as Env).DB;
const NOW = 1_000_000_000_000;
const DAY = 24 * 60 * 60 * 1000;
const PW = 'a long enough password';

beforeEach(async () => {
  for (const t of ['sessions', 'invites', 'passwords', 'users', 'rate_limits', 'ops_applied', 'workouts', 'settings', 'bodyweight']) {
    await db.prepare(`DELETE FROM ${t}`).run();
  }
});

async function codeFrom(userId: string): Promise<string> {
  return createInvite(db, userId, NOW);
}

describe('sign-up with an invite', () => {
  it('a valid unused invite creates the account, a session, and uses up the invite', async () => {
    const owner = await ownerSetupWithUser('owner_one');
    const code = await codeFrom(owner);
    const { userId, token } = await signUp(db, { code, username: 'newbie', password: PW }, NOW);
    expect(userId).not.toBe(owner);
    expect(await resolveSession(db, token, NOW)).toBe(userId);
    await expect(signUp(db, { code, username: 'second', password: PW }, NOW)).rejects.toMatchObject({
      code: 'invite_invalid',
    });
  });

  it('an unknown invite code is refused with the same message as a used one', async () => {
    await expect(signUp(db, { code: 'NOTACODENOTACODENOTACODENOTAAA', username: 'x_one', password: PW }, NOW)).rejects.toMatchObject({
      code: 'invite_invalid',
    });
  });

  it('a taken username is refused, and the invite is not used up', async () => {
    const owner = await ownerSetupWithUser('owner_two');
    const code = await codeFrom(owner);
    await expect(signUp(db, { code, username: 'owner_two', password: PW }, NOW)).rejects.toMatchObject({
      code: 'username_taken',
    });
    // Still usable with a free name.
    await expect(signUp(db, { code, username: 'free_name', password: PW }, NOW)).resolves.toBeDefined();
  });

  it('a bad username or a short password is refused before anything is stored', async () => {
    const owner = await ownerSetupWithUser('owner_three');
    const code = await codeFrom(owner);
    await expect(signUp(db, { code, username: 'Bad Name', password: PW }, NOW)).rejects.toMatchObject({ code: 'bad_input' });
    await expect(signUp(db, { code, username: 'okname', password: 'short' }, NOW)).rejects.toMatchObject({ code: 'bad_input' });
    expect((await db.prepare('SELECT COUNT(*) AS n FROM invites WHERE used_at IS NULL').first<{ n: number }>())?.n).toBe(1);
  });
});

describe('sign-in', () => {
  it('the right password gives a session; a wrong password or an unknown user gives the same error', async () => {
    const owner = await ownerSetupWithUser('signer_one');
    await setPassword(owner, PW);
    expect((await signIn(db, { username: 'signer_one', password: PW }, NOW)).userId).toBe(owner);
    const wrong = await signIn(db, { username: 'signer_one', password: 'wrong password here' }, NOW).catch((e) => e);
    const unknown = await signIn(db, { username: 'nobody_here', password: PW }, NOW).catch((e) => e);
    expect(wrong).toBeInstanceOf(AuthError);
    expect(wrong.code).toBe('invalid_credentials');
    expect(unknown.code).toBe('invalid_credentials');
  });

  it('a session expires after the configured days', async () => {
    const owner = await ownerSetupWithUser('signer_two');
    await setPassword(owner, PW);
    const { token } = await signIn(db, { username: 'signer_two', password: PW }, NOW);
    expect(await resolveSession(db, token, NOW + 29 * DAY)).toBe(owner);
    expect(await resolveSession(db, token, NOW + 31 * DAY)).toBeNull();
  });

  it('sign out ends the session', async () => {
    const owner = await ownerSetupWithUser('signer_three');
    await setPassword(owner, PW);
    const { token } = await signIn(db, { username: 'signer_three', password: PW }, NOW);
    await signOut(db, token);
    expect(await resolveSession(db, token, NOW)).toBeNull();
  });
});

describe('secrets are stored as hashes', () => {
  it('no session token and no invite code is stored in plain text', async () => {
    const owner = await ownerSetupWithUser('hashed_one');
    await setPassword(owner, PW);
    const code = await codeFrom(owner);
    const { token } = await signIn(db, { username: 'hashed_one', password: PW }, NOW);

    const sessions = await db.prepare('SELECT token_hash FROM sessions').all<{ token_hash: string }>();
    expect(sessions.results.map((r) => r.token_hash)).toContain(await sha256Hex(token));
    expect(sessions.results.map((r) => r.token_hash)).not.toContain(token);

    const invites = await db.prepare('SELECT code_hash FROM invites').all<{ code_hash: string }>();
    expect(invites.results.map((r) => r.code_hash)).toContain(await sha256Hex(code));
    expect(invites.results.map((r) => r.code_hash)).not.toContain(code);
  });
});

describe('expired sessions and old rate-limit windows are removed', () => {
  it('a sign-in clears what has expired, and keeps what is still valid', async () => {
    const owner = await ownerSetupWithUser('pruner');
    await setPassword(owner, PW);
    await db
      .prepare('INSERT INTO sessions (token_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)')
      .bind('old-expired-hash', owner, NOW - 2 * DAY, NOW - 1)
      .run();
    await db
      .prepare('INSERT INTO rate_limits (key, window_start, count) VALUES (?, ?, ?)')
      .bind('signin:stale', NOW - 60 * 60 * 1000, 3)
      .run();
    await signIn(db, { username: 'pruner', password: PW }, NOW);
    const expired = await db.prepare("SELECT COUNT(*) AS n FROM sessions WHERE token_hash = 'old-expired-hash'").first<{ n: number }>();
    const stale = await db.prepare("SELECT COUNT(*) AS n FROM rate_limits WHERE key = 'signin:stale'").first<{ n: number }>();
    const fresh = await db.prepare('SELECT COUNT(*) AS n FROM sessions WHERE user_id = ?').bind(owner).first<{ n: number }>();
    expect(expired?.n).toBe(0);
    expect(stale?.n).toBe(0);
    expect(fresh?.n).toBe(1);
  });
});

describe('two accounts stay apart', () => {
  it('a session resolves to its own user, never another', async () => {
    const a = await ownerSetupWithUser('acct_a');
    const b = await ownerSetupWithUser('acct_b');
    await setPassword(a, PW);
    await setPassword(b, PW);
    const sa = await signIn(db, { username: 'acct_a', password: PW }, NOW);
    const sb = await signIn(db, { username: 'acct_b', password: PW }, NOW);
    expect(await resolveSession(db, sa.token, NOW)).toBe(a);
    expect(await resolveSession(db, sb.token, NOW)).toBe(b);
  });
});

describe('recovery with an invite the user issued', () => {
  it('a forgotten password is reset with a code the user holds; old sessions end, the code is used up', async () => {
    const owner = await ownerSetupWithUser('forgetful');
    await setPassword(owner, PW);
    const old = await signIn(db, { username: 'forgetful', password: PW }, NOW);
    const code = await codeFrom(owner);

    const { token } = await recover(db, { username: 'forgetful', code, newPassword: 'brand new password' }, NOW);
    expect(await resolveSession(db, token, NOW)).toBe(owner);
    expect(await resolveSession(db, old.token, NOW)).toBeNull();
    await expect(signIn(db, { username: 'forgetful', password: PW }, NOW)).rejects.toMatchObject({ code: 'invalid_credentials' });
    await expect(signIn(db, { username: 'forgetful', password: 'brand new password' }, NOW)).resolves.toBeDefined();
    await expect(recover(db, { username: 'forgetful', code, newPassword: 'again again again' }, NOW)).rejects.toMatchObject({
      code: 'invite_invalid',
    });
  });

  it('a code issued by someone else cannot reset this account', async () => {
    const owner = await ownerSetupWithUser('target_acct');
    const other = await ownerSetupWithUser('other_acct');
    await setPassword(owner, PW);
    const foreign = await codeFrom(other);
    await expect(recover(db, { username: 'target_acct', code: foreign, newPassword: 'new new new new' }, NOW)).rejects.toMatchObject({
      code: 'invite_invalid',
    });
  });

  it('with every code lost there is no recovery path (SPEC §6.1, accepted)', async () => {
    const owner = await ownerSetupWithUser('lost_codes');
    await setPassword(owner, PW);
    await expect(recover(db, { username: 'lost_codes', code: 'ANYTHINGANYTHINGANYTHINGANYTH', newPassword: 'new new new new' }, NOW)).rejects.toMatchObject({
      code: 'invite_invalid',
    });
  });
});

describe('owner setup (the bootstrap account keeps its data)', () => {
  it('sets the username and password of the owner account once', async () => {
    await ownerSetup(db, { username: 'guy_owner', password: PW }, NOW);
    expect((await signIn(db, { username: 'guy_owner', password: PW }, NOW)).userId).toBe('u_bootstrap');
    await expect(ownerSetup(db, { username: 'other_name', password: PW }, NOW)).rejects.toMatchObject({ code: 'already_set' });
  });
});

// Helpers: an account that exists, and its password set to a known value.
async function ownerSetupWithUser(username: string): Promise<string> {
  const id = `u_${username}`;
  await db.prepare('INSERT INTO users (id, username, created_at) VALUES (?, ?, ?)').bind(id, username, NOW).run();
  return id;
}

async function setPassword(userId: string, password: string): Promise<void> {
  const { hashPassword } = await import('./password');
  const s = await hashPassword(password);
  await db
    .prepare('INSERT OR REPLACE INTO passwords (user_id, hash, salt, iterations, updated_at) VALUES (?, ?, ?, ?, ?)')
    .bind(userId, s.hash, s.salt, s.iterations, NOW)
    .run();
}
