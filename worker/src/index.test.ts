import { describe, it, expect } from 'vitest';
import { env } from 'cloudflare:test';
import worker from './index';
import type { Env } from './env';

const e = env as unknown as Env;
const AUTH = { Authorization: 'Bearer test-bootstrap-token' };

describe('body size limit', () => {
  it('refuses a body over 1 MB measured in bytes, not characters', async () => {
    // 340,000 characters of 3 bytes each is about 1.02 MB: under a character count, but over the byte limit.
    const body = '€'.repeat(340_000);
    const res = await worker.fetch(
      new Request('https://api.example/api/sync/push', { method: 'POST', headers: AUTH, body }),
      e,
    );
    expect(res.status).toBe(413);
  });

  it('answers a normal request', async () => {
    const res = await worker.fetch(new Request('https://api.example/api/health'), e);
    expect(res.status).toBe(200);
  });
});
