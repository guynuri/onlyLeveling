import { describe, it, expect } from 'vitest';
import { runChain, type Provider } from './chain';

const ok = (text: string): Provider => ({ name: 'p-ok', complete: async () => text });
const bad = (text: string): Provider => ({ name: 'p-bad', complete: async () => text });
const down: Provider = {
  name: 'p-down',
  complete: async () => {
    throw new Error('network');
  },
};
// Accepts only the literal 'good'.
const check = (raw: string) => (raw === 'good' ? { ok: true as const, value: raw } : { ok: false as const, errors: ['bad'] });

describe('provider chain: retry once, then fall back', () => {
  it('first provider answers validly: one attempt', async () => {
    const out = await runChain([ok('good')], 'p', check, 1000);
    expect(out).toMatchObject({ status: 'ai', provider: 'p-ok', attempts: 1 });
  });

  it('invalid from the first provider: the second is tried once', async () => {
    const out = await runChain([bad('nope'), ok('good')], 'p', check, 1000);
    expect(out).toMatchObject({ status: 'ai', provider: 'p-ok', attempts: 2 });
  });

  it('invalid twice on one provider: fallback with reason invalid', async () => {
    const out = await runChain([bad('nope')], 'p', check, 1000);
    expect(out).toEqual({ status: 'fallback', reason: 'invalid', attempts: 2, detail: 'bad' });
  });

  it('unreachable counts the same as invalid', async () => {
    const out = await runChain([down, ok('good')], 'p', check, 1000);
    expect(out).toMatchObject({ status: 'ai', attempts: 2 });
    expect(await runChain([down], 'p', check, 1000)).toEqual({ status: 'fallback', reason: 'unreachable', attempts: 2, detail: 'network' });
  });

  it('no provider configured: fallback with no attempts', async () => {
    expect(await runChain([], 'p', check, 1000)).toEqual({ status: 'fallback', reason: 'none', attempts: 0 });
  });

  it('a provider that hangs past the timeout counts as unreachable', async () => {
    const slow: Provider = { name: 'slow', complete: () => new Promise(() => undefined) };
    const out = await runChain([slow], 'p', check, 10);
    expect(out).toMatchObject({ status: 'fallback', reason: 'unreachable', attempts: 2 });
    expect(out.status === 'fallback' && out.detail).toBeTruthy();
  });
});
