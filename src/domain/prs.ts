// Weight PR against history (SPEC §3.5). The caller passes history WITHOUT the current session.
import type { HistorySession } from './progression';

export function bestWeight(history: readonly HistorySession[]): number | null {
  let best: number | null = null;
  for (const s of history) {
    for (const set of s.sets) {
      if (set.done && (best === null || set.w > best)) best = set.w;
    }
  }
  return best;
}

// A new weight PR only when strictly above the best done weight in history.
export function isNewWeightPR(w: number, history: readonly HistorySession[]): boolean {
  const best = bestWeight(history);
  return best === null ? w > 0 : w > best;
}
