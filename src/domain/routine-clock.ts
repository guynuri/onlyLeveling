// The warm-up and cool-down timer (owner request 2026-11-07: they get real time in the session). Items run one after
// another; `elapsedMs` is wall-clock time since the phase started plus any skipped time. Pure.
export function routineAt(items: readonly { seconds: number }[], elapsedMs: number): { index: number; left: number } {
  let t = Math.max(0, elapsedMs) / 1000;
  for (let i = 0; i < items.length; i++) {
    if (t < items[i].seconds) return { index: i, left: Math.ceil(items[i].seconds - t) };
    t -= items[i].seconds;
  }
  return { index: items.length, left: 0 }; // all done
}

// Milliseconds to add to jump to the start of the next item.
export function skipMs(items: readonly { seconds: number }[], elapsedMs: number): number {
  const { index } = routineAt(items, elapsedMs);
  if (index >= items.length) return 0;
  const before = items.slice(0, index).reduce((s, x) => s + x.seconds, 0) * 1000;
  return before + items[index].seconds * 1000 - Math.max(0, elapsedMs);
}
