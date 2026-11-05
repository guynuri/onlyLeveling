import { describe, it, expect, beforeEach } from 'vitest';
import { env } from 'cloudflare:test';
import worker from '../index';
import type { Env } from '../env';

const e = env as unknown as Env;
const OWNER = { Authorization: 'Bearer test-bootstrap-token' };
const PW = 'a long enough password';
const URL = 'https://api.example';

beforeEach(async () => {
  for (const t of ['sessions', 'invites', 'passwords', 'users', 'rate_limits']) {
    await e.DB.prepare(`DELETE FROM ${t}`).run();
  }
});

const post = (path: string, body: unknown, headers: Record<string, string> = {}) =>
  worker.fetch(
    new Request(`${URL}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify(body),
    }),
    e,
  );

async function ownerSetup(username = 'owner_name') {
  return post('/api/auth/owner-setup', { username, password: PW }, OWNER);
}

async function inviteCode(): Promise<string> {
  const res = await post('/api/invites', {}, OWNER);
  return ((await res.json()) as { code: string }).code;
}

describe('owner setup and invites', () => {
  it('the owner key sets the owner password once', async () => {
    expect((await ownerSetup()).status).toBe(200);
    expect((await ownerSetup('again_name')).status).toBe(409);
  });

  it('owner setup needs the owner key, not an ordinary session', async () => {
    expect((await post('/api/auth/owner-setup', { username: 'x_name', password: PW })).status).toBe(401);
  });

  it('issuing an invite needs a signed-in account', async () => {
    expect((await post('/api/invites', {})).status).toBe(401);
    expect((await post('/api/invites', {}, OWNER)).status).toBe(200);
  });
});

describe('sign-up, sign-in and sign-out', () => {
  it('an invite lets someone sign up, then sign in with the password', async () => {
    await ownerSetup();
    const code = await inviteCode();
    const up = await post('/api/auth/signup', { code, username: 'friend_one', password: PW });
    expect(up.status).toBe(200);
    const { token } = (await up.json()) as { token: string };
    expect(token.length).toBeGreaterThan(40);

    const sin = await post('/api/auth/signin', { username: 'friend_one', password: PW });
    expect(sin.status).toBe(200);
  });

  it('a used invite is refused, and a wrong password gets 401', async () => {
    await ownerSetup();
    const code = await inviteCode();
    await post('/api/auth/signup', { code, username: 'friend_two', password: PW });
    expect((await post('/api/auth/signup', { code, username: 'friend_three', password: PW })).status).toBe(400);
    expect((await post('/api/auth/signin', { username: 'friend_two', password: 'wrong wrong wrong' })).status).toBe(401);
  });

  it('a session works on the API and sign-out ends it', async () => {
    await ownerSetup();
    const code = await inviteCode();
    const { token } = (await (await post('/api/auth/signup', { code, username: 'friend_four', password: PW })).json()) as {
      token: string;
    };
    const auth = { Authorization: `Bearer ${token}` };
    expect((await post('/api/invites', {}, auth)).status).toBe(200);
    expect((await post('/api/auth/signout', {}, auth)).status).toBe(200);
    expect((await post('/api/invites', {}, auth)).status).toBe(401);
  });

  it('a body that is not valid JSON, or has a bad username, is a 400 with a JSON reason', async () => {
    const res = await worker.fetch(
      new Request(`${URL}/api/auth/signin`, { method: 'POST', body: '{not json' }),
      e,
    );
    expect(res.status).toBe(400);
    const bad = await post('/api/auth/signup', { code: 'X', username: 'Bad Name', password: PW });
    expect(bad.status).toBe(400);
    expect(await bad.json()).toMatchObject({ error: expect.stringContaining('Usernames') });
  });
});

describe('body size on the public auth routes', () => {
  it('a sign-in body over the limit is refused with 413 before it is parsed', async () => {
    const big = '€'.repeat(340_000);
    const res = await worker.fetch(
      new Request(`${URL}/api/auth/signin`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: big }),
      e,
    );
    expect(res.status).toBe(413);
  });
});

describe('rate limits on sign-in, sign-up and recovery', () => {
  it('after 10 wrong sign-in attempts from one IP the next is refused with 429', async () => {
    await ownerSetup();
    const headers = { 'CF-Connecting-IP': '9.9.9.9' };
    for (let i = 0; i < 10; i++) {
      expect((await post('/api/auth/signin', { username: 'owner_name', password: 'wrong wrong wrong' }, headers)).status).toBe(401);
    }
    expect((await post('/api/auth/signin', { username: 'owner_name', password: 'wrong wrong wrong' }, headers)).status).toBe(429);
  });
});
