import { describe, it, expect } from 'vitest';
import { authenticate, bearerToken } from './auth';

const SECRET = 'correct-horse-battery-staple';
const env = { BOOTSTRAP_TOKEN: SECRET };

const req = (headers: Record<string, string>) => new Request('https://api.example/x', { headers });

describe('bearerToken', () => {
  it('reads the Authorization: Bearer header', () => {
    expect(bearerToken(req({ Authorization: `Bearer ${SECRET}` }))).toBe(SECRET);
  });

  it('is null without the header or with another scheme', () => {
    expect(bearerToken(req({}))).toBeNull();
    expect(bearerToken(req({ Authorization: `Basic ${SECRET}` }))).toBeNull();
  });
});

describe('authenticate (Phase 4a: one bootstrap account)', () => {
  it('a correct bearer token authenticates the bootstrap user', () => {
    expect(authenticate(req({ Authorization: `Bearer ${SECRET}` }), env)).toEqual({ userId: 'u_bootstrap' });
  });

  it('a wrong or missing token is rejected', () => {
    expect(authenticate(req({ Authorization: 'Bearer nope' }), env)).toBeNull();
    expect(authenticate(req({}), env)).toBeNull();
  });

  it('an empty configured secret never authenticates anyone', () => {
    expect(authenticate(req({ Authorization: 'Bearer ' }), { BOOTSTRAP_TOKEN: '' })).toBeNull();
  });

  it('a cookie alone never authenticates (auth is the bearer header only)', () => {
    expect(authenticate(req({ Cookie: `session=${SECRET}` }), env)).toBeNull();
  });
});
