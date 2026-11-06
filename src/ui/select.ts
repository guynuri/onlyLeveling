// Small pure helpers behind the shared components. Tested.

// Multi-select toggle: removes v when present, appends it otherwise. Returns a new array.
export function toggleIn<T>(list: readonly T[], v: T): T[] {
  return list.includes(v) ? list.filter((x) => x !== v) : [...list, v];
}

// Percentage of max, clamped to 0..100. A max of 0 or less is 0.
export function pct(value: number, max: number): number {
  if (max <= 0) return 0;
  return Math.min(100, Math.max(0, (value / max) * 100));
}
