import { describe, it, expect } from 'vitest';
import { runChain, workersAiProvider, type Provider } from './chain';

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
    expect(out).toEqual({ status: 'fallback', reason: 'invalid', attempts: 2, detail: 'the answer broke a plan rule' });
  });

  it('unreachable counts the same as invalid', async () => {
    const out = await runChain([down, ok('good')], 'p', check, 1000);
    expect(out).toMatchObject({ status: 'ai', attempts: 2 });
    expect(await runChain([down], 'p', check, 1000)).toEqual({ status: 'fallback', reason: 'unreachable', attempts: 2, detail: 'the AI service failed' });
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

describe('workersAiProvider answer shapes', () => {
  const binding = (out: unknown, seen: unknown[] = []) => ({ run: async (_m: string, input: object) => (seen.push(input), out) });
  it('reads text, a parsed object, or an OpenAI-style answer, and passes max_tokens', async () => {
    const seen: unknown[] = [];
    expect(await workersAiProvider(binding({ response: 'hi' }, seen), 'm', 2048).complete('p')).toBe('hi');
    expect(seen[0]).toMatchObject({ max_tokens: 2048 });
    expect(await workersAiProvider(binding({ response: { a: 1 } }), 'm').complete('p')).toBe('{"a":1}');
    expect(await workersAiProvider(binding({ choices: [{ message: { content: 'x' } }] }), 'm').complete('p')).toBe('x');
    await expect(workersAiProvider(binding({}), 'm').complete('p')).rejects.toThrow('no text in response');
  });
});
