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
  | { status: 'fallback'; reason: 'invalid' | 'unreachable' | 'none'; attempts: number; detail?: string };

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
  let detail: string | undefined; // the last failure, short, so the app can say what went wrong (owner report 2026-11-07)
  for (let i = 0; i < TRIES; i++) {
    const provider = providers[Math.min(i, providers.length - 1)];
    attempts++;
    let raw: string;
    try {
      raw = await withTimeout(provider.complete(prompt), timeoutMs);
    } catch (e) {
      reason = 'unreachable';
      // A category only: provider messages can carry internals, so they never reach the app.
      detail = e instanceof Error && /timed? ?out/i.test(e.message) ? 'the AI took too long' : 'the AI service failed';
      continue;
    }
    const result = check(raw);
    if (result.ok) return { status: 'ai', provider: provider.name, value: result.value, attempts };
    reason = 'invalid';
    detail = result.errors[0] === 'not JSON' ? 'the answer was cut off or not JSON' : 'the answer broke a plan rule';
  }
  return { status: 'fallback', reason, attempts, ...(detail ? { detail } : {}) };
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error('timeout')), ms);
  });
  return Promise.race([p, timeout]).finally(() => clearTimeout(timer));
}

// Workers AI through its binding (no API key). The only place that knows the binding's shape.
export function workersAiProvider(ai: unknown, model: string, maxTokens = 0): Provider {
  const binding = ai as { run(model: string, input: object): Promise<unknown> };
  return {
    name: 'workers-ai',
    async complete(prompt) {
      const out = (await binding.run(model, { messages: [{ role: 'user', content: prompt }], ...(maxTokens > 0 ? { max_tokens: maxTokens } : {}) })) as {
        response?: unknown;
        choices?: { message?: { content?: unknown } }[];
      };
      // Models answer as { response: text }, some as an already-parsed object, newer ones OpenAI-style.
      if (typeof out.response === 'string') return out.response;
      if (out.response && typeof out.response === 'object') return JSON.stringify(out.response);
      const content = out.choices?.[0]?.message?.content;
      if (typeof content === 'string') return content;
      throw new Error('no text in response');
    },
  };
}
