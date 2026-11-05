import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { signInWithPassword, signOut, readSyncState, createInvite } from './actions';
import { AuthClientError } from '../../data/auth-client';
import { getDb } from '../training/data';

const BASE = 'https://api.example';

// Each test starts with no stored session.
beforeEach(async () => {
  await (await getDb()).clear('meta');
});

// A server that accepts one password and answers the sync calls.
function server(opts: { password?: string } = {}) {
  const seen: { url: string; auth?: string }[] = [];
  const fetchImpl = (async (url: string | URL | Request, init?: RequestInit) => {
    const u = String(url);
    const headers = (init?.headers ?? {}) as Record<string, string>;
    seen.push({ url: u, auth: headers.Authorization });
    const json = (b: unknown, status = 200) =>
      new Response(JSON.stringify(b), { status, headers: { 'Content-Type': 'application/json' } });
    if (u.endsWith('/api/auth/signin')) {
      const body = JSON.parse(String(init?.body)) as { password: string };
      if (body.password !== (opts.password ?? 'right password here')) {
        return json({ error: 'Wrong username or password.', code: 'invalid_credentials' }, 401);
      }
      return json({ token: 'session-abc', userId: 'u_1' });
    }
    if (u.includes('/api/sync/pull')) {
      return json({ workouts: [], settings: null, bodyweight: [], serverTime: 42 });
    }
    if (u.endsWith('/api/sync/push')) return json({ applied: 0, duplicates: 0 });
    if (u.endsWith('/api/auth/signout')) return json({ ok: true });
    if (u.endsWith('/api/invites')) return json({ code: 'INVITECODE' });
    return json({ error: 'not found' }, 404);
  }) as typeof fetch;
  return { fetchImpl, seen };
}

describe('sign-in from the app', () => {
  it('a right password stores the session on this device and syncs', async () => {
    const { fetchImpl } = server();
    const state = await signInWithPassword(BASE, 'guy', 'right password here', fetchImpl);
    expect(state.config).toEqual({ baseUrl: BASE, token: 'session-abc' });
    expect(state.lastError).toBeNull();
    expect(state.cursor).toBe(42);
    expect((await readSyncState()).config?.token).toBe('session-abc');
  });

  it('a wrong password is refused and stores nothing', async () => {
    const { fetchImpl } = server();
    const err = await signInWithPassword(BASE, 'guy', 'wrong wrong wrong', fetchImpl).catch((e) => e);
    expect(err).toBeInstanceOf(AuthClientError);
    expect(err.code).toBe('invalid_credentials');
    expect((await readSyncState()).config).toBeNull();
  });
});

describe('sign-out and invites', () => {
  it('sign-out ends the session on the server and forgets it on the device', async () => {
    const { fetchImpl, seen } = server();
    await signInWithPassword(BASE, 'guy', 'right password here', fetchImpl);
    await signOut(fetchImpl);
    expect(seen.some((s) => s.url.endsWith('/api/auth/signout') && s.auth === 'Bearer session-abc')).toBe(true);
    expect((await readSyncState()).config).toBeNull();
  });

  it('an invite code is created with the session and returned once', async () => {
    const { fetchImpl } = server();
    await signInWithPassword(BASE, 'guy', 'right password here', fetchImpl);
    expect(await createInvite(fetchImpl)).toBe('INVITECODE');
  });

  it('creating an invite while signed out is refused', async () => {
    const { fetchImpl } = server();
    await signOut(fetchImpl);
    await expect(createInvite(fetchImpl)).rejects.toThrow(/Sign in/);
  });
});
