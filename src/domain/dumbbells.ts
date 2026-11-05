// Owned-dumbbell arithmetic (SPEC §3.4). Owned weights are an exact list per unit; results stay on it.
const EPS = 1e-9;

// The n-th owned weight above w (n = 2 is a double jump: two bells up). Null at the top of the list.
export function ownedUp(ws: readonly number[], w: number, n = 1): number | null {
  const above = ws.filter((x) => x > w + EPS).sort((a, b) => a - b);
  if (above.length === 0) return null;
  return above[Math.min(n, above.length) - 1];
}

// The nearest owned weight below w. Null under the lightest.
export function ownedDown(ws: readonly number[], w: number): number | null {
  const below = ws.filter((x) => x < w - EPS).sort((a, b) => a - b);
  return below.length ? below[below.length - 1] : null;
}

// One stepper tap: the neighbour in that direction, or the same weight at either end.
export function stepOwned(ws: readonly number[], w: number, dir: 1 | -1): number {
  return (dir > 0 ? ownedUp(ws, w) : ownedDown(ws, w)) ?? w;
}

// The heaviest owned weight at or under x; the lightest owned weight if none is; 0 when the list is empty.
export function ownedFloor(ws: readonly number[], x: number): number {
  const sorted = [...ws].sort((a, b) => a - b);
  const under = sorted.filter((v) => v <= x + EPS);
  return under.length ? under[under.length - 1] : (sorted[0] ?? 0);
}

// One-arm work uses one bell; otherwise both hands hold one bell each.
export function bellsIn(oneArm: boolean): 1 | 2 {
  return oneArm ? 1 : 2;
}

// The load counted for volume, per the load meaning stamped on the session (SPEC §3.3, REFERENCE_NOTES §8):
//   as    — the number is counted as typed
//   each  — the number is per bell, so it is multiplied by the bells in use
//   total — the number is the whole load, counted as typed
export type LoadMode = 'as' | 'each' | 'total';
export function loadForVolume(w: number, mode: LoadMode, bells: 1 | 2): number {
  return mode === 'each' ? w * bells : w;
}
