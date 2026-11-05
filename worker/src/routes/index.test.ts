import { describe, it, expect } from 'vitest';
import { env } from 'cloudflare:test';
import { routeSlots, runSlots, ROUTE_SLOTS } from './index';
import type { Env } from '../env';

const principal = { userId: 'u_bootstrap' };
const req = new Request('https://api.example/api/coach');
const e = env as unknown as Env;

describe('Worker route slots (reserved, empty at the freeze)', () => {
  it('reserves the five Wave 2 slots in order', () => {
    expect(ROUTE_SLOTS).toEqual(['coach', 'xp', 'ai', 'push', 'nutrition']);
  });

  it('nothing is routed yet, so every request falls through', async () => {
    expect(await routeSlots(req, e, principal)).toBeNull();
  });
});

describe('runSlots dispatch', () => {
  it('returns the first handler response and stops there', async () => {
    const calls: string[] = [];
    const first = async () => {
      calls.push('first');
      return new Response('one');
    };
    const second = async () => {
      calls.push('second');
      return new Response('two');
    };
    const res = await runSlots([first, second], req, e, principal);
    expect(await res?.text()).toBe('one');
    expect(calls).toEqual(['first']);
  });

  it('a throwing handler rejects the call, so the caller error handler still runs', async () => {
    const boom = async () => {
      throw new Error('D1 is down');
    };
    await expect(runSlots([boom], req, e, principal)).rejects.toThrow('D1 is down');
  });
});
