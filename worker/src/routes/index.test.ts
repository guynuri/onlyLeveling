import { describe, it, expect } from 'vitest';
import { env } from 'cloudflare:test';
import { routeSlots, ROUTE_SLOTS } from './index';
import type { Env } from '../env';

describe('Worker route slots (reserved, empty at the freeze)', () => {
  it('reserves the five Wave 2 slots in order', () => {
    expect(ROUTE_SLOTS).toEqual(['coach', 'xp', 'ai', 'push', 'nutrition']);
  });

  it('nothing is routed yet, so every request falls through', async () => {
    const principal = { userId: 'u_bootstrap' };
    for (const path of ['/api/coach', '/api/xp', '/api/ai/plan', '/api/push/subscribe']) {
      const res = await routeSlots(new Request(`https://api.example${path}`), env as unknown as Env, principal);
      expect(res).toBeNull();
    }
  });
});
