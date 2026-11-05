// Provider chain (SPEC §5.2, §5.6). Retry once: the first try uses the first provider; a second try uses the next
// provider, or the same one again when only one is configured. Invalid output and unreachable providers count the same.
// Provider names appear only in this file (CLAUDE.md: nothing else may depend on a provider).

export interface Provider {
  name: string;
  complete(prompt: string): Promise<string>;
}

export type Check<T> = { ok: true; value: T } | { ok: false; errors: string[] };

export type ChainOutcome<T> =
  | { status: 'ai'; provider: string; value: T; attempts: number }
  | { status: 'fallback'; reason: 'invalid' | 'unreachable' | 'none'; attempts: number };

const TRIES = 2;

export async function runChain<T>(
  providers: readonly Provider[],
  prompt: string,
  check: (raw: string) => Check<T>,
  timeoutMs: number,
): Promise<ChainOutcome<T>> {
  if (providers.length === 0) return { status: 'fallback', reason: 'none', attempts: 0 };
  let reason: 'invalid' | 'unreachable' = 'unreachable';
  let attempts = 0;
  for (let i = 0; i < TRIES; i++) {
    const provider = providers[Math.min(i, providers.length - 1)];
    attempts++;
    let raw: string;
    try {
      raw = await withTimeout(provider.complete(prompt), timeoutMs);
    } catch {
      reason = 'unreachable';
      continue;
    }
    const result = check(raw);
    if (result.ok) return { status: 'ai', provider: provider.name, value: result.value, attempts };
    reason = 'invalid';
  }
  return { status: 'fallback', reason, attempts };
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error('timeout')), ms);
  });
  return Promise.race([p, timeout]).finally(() => clearTimeout(timer));
}

// Workers AI through its binding (no API key). The only place that knows the binding's shape.
export function workersAiProvider(ai: unknown, model: string): Provider {
  const binding = ai as { run(model: string, input: object): Promise<unknown> };
  return {
    name: 'workers-ai',
    async complete(prompt) {
      const out = (await binding.run(model, { messages: [{ role: 'user', content: prompt }] })) as { response?: unknown };
      if (typeof out.response !== 'string') throw new Error('no text in response');
      return out.response;
    },
  };
}
