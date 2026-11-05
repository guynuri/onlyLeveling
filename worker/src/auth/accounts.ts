// Accounts: sign-up with an invite, sign-in, sessions, recovery with an invite, and the owner's one-time setup.
// Every lookup is by hash (codes, tokens). Error codes are fixed strings the app can show.
import { AUTH } from '../config';
import { generateCode, generateToken, hashCode, isValidUsername, sha256Hex } from './codes';
import { hashPassword, verifyPassword, type StoredPassword } from './password';

export type AuthErrorCode =
  | 'invite_invalid'
  | 'username_taken'
  | 'bad_input'
  | 'invalid_credentials'
  | 'already_set';

export class AuthError extends Error {
  constructor(readonly code: AuthErrorCode, message?: string) {
    super(message ?? code);
  }
}

const DAY_MS = 24 * 60 * 60 * 1000;
const OWNER_ID = 'u_bootstrap'; // the account that already owns the data from Phase 4a

export async function createInvite(db: D1Database, issuedBy: string, now: number): Promise<string> {
  const code = generateCode();
  await db
    .prepare('INSERT INTO invites (code_hash, issued_by, created_at) VALUES (?, ?, ?)')
    .bind(await hashCode(code), issuedBy, now)
    .run();
  return code;
}

// Claim an unused invite for one user. Atomic: the row changes only while it is still unused (and, for
// recovery, still issued by that user). Returns false when the code cannot be used.
async function claimInvite(
  db: D1Database,
  code: string,
  userId: string,
  now: number,
  issuedBy?: string,
): Promise<boolean> {
  const hash = await hashCode(code);
  const sql = issuedBy
    ? 'UPDATE invites SET used_by = ?, used_at = ? WHERE code_hash = ? AND used_at IS NULL AND issued_by = ?'
    : 'UPDATE invites SET used_by = ?, used_at = ? WHERE code_hash = ? AND used_at IS NULL';
  const binds = issuedBy ? [userId, now, hash, issuedBy] : [userId, now, hash];
  const res = await db.prepare(sql).bind(...binds).run();
  return res.meta.changes === 1;
}

// Undo a claim when the account could not be created (for example the name was taken).
async function releaseInvite(db: D1Database, code: string, userId: string): Promise<void> {
  await db
    .prepare('UPDATE invites SET used_by = NULL, used_at = NULL WHERE code_hash = ? AND used_by = ?')
    .bind(await hashCode(code), userId)
    .run();
}

function checkUsername(username: string): string {
  const u = username.trim().toLowerCase();
  if (!isValidUsername(u)) throw new AuthError('bad_input', 'Usernames are 3–32 letters, digits or underscores.');
  return u;
}

function checkPassword(password: string): void {
  if (password.length < AUTH.minPasswordLength) {
    throw new AuthError('bad_input', `Passwords are at least ${AUTH.minPasswordLength} characters.`);
  }
}

async function storePassword(db: D1Database, userId: string, s: StoredPassword, now: number): Promise<void> {
  await db
    .prepare(
      `INSERT INTO passwords (user_id, hash, salt, iterations, updated_at) VALUES (?, ?, ?, ?, ?)
       ON CONFLICT (user_id) DO UPDATE SET hash = excluded.hash, salt = excluded.salt,
         iterations = excluded.iterations, updated_at = excluded.updated_at`,
    )
    .bind(userId, s.hash, s.salt, s.iterations, now)
    .run();
}

async function openSession(db: D1Database, userId: string, now: number): Promise<string> {
  const token = generateToken();
  await db
    .prepare('INSERT INTO sessions (token_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)')
    .bind(await sha256Hex(token), userId, now, now + AUTH.sessionDays * DAY_MS)
    .run();
  return token;
}

export async function signUp(
  db: D1Database,
  input: { code: string; username: string; password: string },
  now: number,
): Promise<{ userId: string; token: string }> {
  const username = checkUsername(input.username);
  checkPassword(input.password);
  const userId = `u_${crypto.randomUUID()}`;

  if (!(await claimInvite(db, input.code, userId, now))) {
    throw new AuthError('invite_invalid', 'That invite code is not valid.');
  }
  try {
    await db
      .prepare('INSERT INTO users (id, username, created_at) VALUES (?, ?, ?)')
      .bind(userId, username, now)
      .run();
  } catch (e) {
    // Give the invite back whatever went wrong. Only a clash on the name is reported as "taken";
    // any other failure is passed on as it is, so the user is not told the wrong thing.
    await releaseInvite(db, input.code, userId);
    if (isUniqueViolation(e)) throw new AuthError('username_taken', 'That username is taken.');
    throw e;
  }
  await storePassword(db, userId, await hashPassword(input.password), now);
  return { userId, token: await openSession(db, userId, now) };
}

// A password check that always runs, against a dummy hash when the user is unknown, so the time taken
// does not reveal whether a username exists.
let dummy: Promise<StoredPassword> | null = null;
const dummyHash = (): Promise<StoredPassword> => (dummy ??= hashPassword('timing-equaliser-password'));

export async function signIn(
  db: D1Database,
  input: { username: string; password: string },
  now: number,
): Promise<{ userId: string; token: string }> {
  await pruneExpired(db, now);
  const username = input.username.trim().toLowerCase();
  const user = await db
    .prepare('SELECT id FROM users WHERE username = ?')
    .bind(username)
    .first<{ id: string }>();
  const stored = user
    ? await db
        .prepare('SELECT hash, salt, iterations FROM passwords WHERE user_id = ?')
        .bind(user.id)
        .first<StoredPassword>()
    : null;
  const ok = await verifyPassword(input.password, stored ?? (await dummyHash()));
  // The same error for an unknown user and a wrong password: no account enumeration.
  if (!user || !stored || !ok) {
    throw new AuthError('invalid_credentials', 'Wrong username or password.');
  }
  return { userId: user.id, token: await openSession(db, user.id, now) };
}

// Expired sessions and rate-limit windows that have closed are removed, so the tables do not grow forever.
export async function pruneExpired(db: D1Database, now: number): Promise<void> {
  await db.prepare('DELETE FROM sessions WHERE expires_at <= ?').bind(now).run();
  await db
    .prepare('DELETE FROM rate_limits WHERE window_start <= ?')
    .bind(now - AUTH.rateLimit.windowSec * 1000)
    .run();
}

function isUniqueViolation(e: unknown): boolean {
  return /UNIQUE/i.test(String(e));
}

// The user a bearer token belongs to, while it has not expired. Null otherwise.
export async function resolveSession(db: D1Database, token: string, now: number): Promise<string | null> {
  const row = await db
    .prepare('SELECT user_id FROM sessions WHERE token_hash = ? AND expires_at > ?')
    .bind(await sha256Hex(token), now)
    .first<{ user_id: string }>();
  return row?.user_id ?? null;
}

export async function signOut(db: D1Database, token: string): Promise<void> {
  await db.prepare('DELETE FROM sessions WHERE token_hash = ?').bind(await sha256Hex(token)).run();
}

// Forgotten password: a code the user issued to themselves resets it. Ends every session on the account.
export async function recover(
  db: D1Database,
  input: { username: string; code: string; newPassword: string },
  now: number,
): Promise<{ token: string }> {
  const username = input.username.trim().toLowerCase();
  checkPassword(input.newPassword);
  const user = await db.prepare('SELECT id FROM users WHERE username = ?').bind(username).first<{ id: string }>();
  if (!user) throw new AuthError('invite_invalid', 'That invite code is not valid for this account.');

  if (!(await claimInvite(db, input.code, user.id, now, user.id))) {
    throw new AuthError('invite_invalid', 'That invite code is not valid for this account.');
  }
  await storePassword(db, user.id, await hashPassword(input.newPassword), now);
  await db.prepare('DELETE FROM sessions WHERE user_id = ?').bind(user.id).run();
  return { token: await openSession(db, user.id, now) };
}

// The owner's account (the one holding the Phase 4a data) gets its username and password once.
export async function ownerSetup(
  db: D1Database,
  input: { username: string; password: string },
  now: number,
): Promise<void> {
  const username = checkUsername(input.username);
  checkPassword(input.password);
  const existing = await db.prepare('SELECT 1 AS x FROM passwords WHERE user_id = ?').bind(OWNER_ID).first();
  if (existing) throw new AuthError('already_set', 'The owner password is already set.');
  try {
    await db
      .prepare('INSERT INTO users (id, username, created_at) VALUES (?, ?, ?) ON CONFLICT (id) DO UPDATE SET username = excluded.username')
      .bind(OWNER_ID, username, now)
      .run();
  } catch (e) {
    if (isUniqueViolation(e)) throw new AuthError('username_taken', 'That username is taken.');
    throw e;
  }
  await storePassword(db, OWNER_ID, await hashPassword(input.password), now);
}
