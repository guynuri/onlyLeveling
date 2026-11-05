import { describe, it, expect } from 'vitest';
import {
  signInRequest,
  signUpRequest,
  recoverRequest,
  signOutRequest,
  createInviteRequest,
  AuthClientError,
} from './auth-client';

const BASE = 'https://api.example';

function recorder(status: number, body: unknown) {
  const calls: { url: string; init: RequestInit }[] = [];
  const fetchImpl = (async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init: init ?? {} });
    return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
  }) as typeof fetch;
  return { fetchImpl, calls };
}

describe('sign-in and sign-up requests', () => {
  it('sign-in posts the username and password as JSON and returns the session token', async () => {
    const { fetchImpl, calls } = recorder(200, { token: 'tok123', userId: 'u_1' });
    const r = await signInRequest({ baseUrl: BASE, fetch: fetchImpl }, { username: 'guy', password: 'pw pw pw pw' });
    expect(r).toEqual({ token: 'tok123', userId: 'u_1' });
    expect(calls[0].url).toBe(`${BASE}/api/auth/signin`);
    expect(JSON.parse(String(calls[0].init.body))).toEqual({ username: 'guy', password: 'pw pw pw pw' });
  });

  it('sign-up posts the invite code, username and password', async () => {
    const { fetchImpl, calls } = recorder(200, { token: 't', userId: 'u_2' });
    await signUpRequest({ baseUrl: BASE, fetch: fetchImpl }, { code: 'ABC', username: 'new_one', password: 'pw pw pw pw' });
    expect(calls[0].url).toBe(`${BASE}/api/auth/signup`);
    expect(JSON.parse(String(calls[0].init.body))).toMatchObject({ code: 'ABC', username: 'new_one' });
  });

  it('recovery posts the username, invite code and new password', async () => {
    const { fetchImpl, calls } = recorder(200, { token: 't' });
    await recoverRequest({ baseUrl: BASE, fetch: fetchImpl }, { username: 'guy', code: 'ABC', newPassword: 'new new new new' });
    expect(calls[0].url).toBe(`${BASE}/api/auth/recover`);
    expect(JSON.parse(String(calls[0].init.body))).toEqual({ username: 'guy', code: 'ABC', newPassword: 'new new new new' });
  });
});

describe('errors from the server become readable', () => {
  it('a wrong password (401) keeps the server code and message', async () => {
    const { fetchImpl } = recorder(401, { error: 'Wrong username or password.', code: 'invalid_credentials' });
    const err = await signInRequest({ baseUrl: BASE, fetch: fetchImpl }, { username: 'guy', password: 'x' }).catch((e) => e);
    expect(err).toBeInstanceOf(AuthClientError);
    expect(err.code).toBe('invalid_credentials');
    expect(err.message).toBe('Wrong username or password.');
  });

  it('too many attempts (429) is reported as rate_limited', async () => {
    const { fetchImpl } = recorder(429, { error: 'Too many attempts.', code: 'rate_limited' });
    const err = await signInRequest({ baseUrl: BASE, fetch: fetchImpl }, { username: 'guy', password: 'x' }).catch((e) => e);
    expect(err.code).toBe('rate_limited');
  });

  it('no network becomes a plain message the user can act on', async () => {
    const fetchImpl = (async () => {
      throw new TypeError('Failed to fetch');
    }) as unknown as typeof fetch;
    const err = await signInRequest({ baseUrl: BASE, fetch: fetchImpl }, { username: 'guy', password: 'x' }).catch((e) => e);
    expect(err.code).toBe('network');
    expect(err.message).toMatch(/could not reach the server/i);
  });
});

describe('signed-in requests and privacy of the request', () => {
  it('sign-out and invite creation send the bearer token, never a cookie, and omit credentials', async () => {
    const { fetchImpl, calls } = recorder(200, { ok: true, code: 'NEWCODE' });
    await signOutRequest({ baseUrl: BASE, fetch: fetchImpl }, 'sess');
    const invite = await createInviteRequest({ baseUrl: BASE, fetch: fetchImpl }, 'sess');
    expect(invite.code).toBe('NEWCODE');
    for (const c of calls) {
      expect((c.init.headers as Record<string, string>).Authorization).toBe('Bearer sess');
      expect((c.init.headers as Record<string, string>).Cookie).toBeUndefined();
      expect(c.init.credentials).toBe('omit');
    }
  });
});
