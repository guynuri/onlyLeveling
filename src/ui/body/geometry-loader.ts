// Load-once with retry: every body map shares one load of the geometry chunk, and a failed load (offline before
// the chunk was cached, a flaky network) is forgotten so the next map tries again instead of staying blank.
export function createLoader<T>(load: () => Promise<T>): (() => Promise<T>) & { cached(): T | null } {
  let value: T | null = null;
  let pending: Promise<T> | null = null;
  const get = () => {
    pending ??= load().then(
      (v) => (value = v),
      (e: unknown) => {
        pending = null;
        throw e;
      },
    );
    return pending;
  };
  return Object.assign(get, { cached: () => value });
}
