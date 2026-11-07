// The load a set is scored with (UX design §3.3). Dumbbell and kettlebell work keeps the weight entered; a band set is a
// fixed load; bodyweight work is a share of bodyweight; a timed hold earns no muscle XP. Pure.
import { UNWEIGHTED_XP } from '../../../config/thresholds';
import { loadKind, type Exercise } from '../../../domain/exercise';

export type XpLoad = { kind: 'entered' } | { kind: 'timed' } | { kind: 'fixed'; kg: number; usedDefault: boolean };

const ROWS = UNWEIGHTED_XP.fractions.map((r) => ({ re: new RegExp(r.match, 'i'), fraction: r.fraction }));

export function xpLoad(ex: Pick<Exercise, 'name' | 'equipment' | 'requires' | 'mode'>, bodyweightKg: number | null): XpLoad {
  if (ex.mode === 'time') return { kind: 'timed' };
  if (loadKind(ex) !== 'none') return { kind: 'entered' };
  if (ex.equipment === 'band') return { kind: 'fixed', kg: UNWEIGHTED_XP.bandLoadKg, usedDefault: false };
  const fraction = ROWS.find((r) => r.re.test(ex.name))?.fraction ?? UNWEIGHTED_XP.defaultFraction;
  const bw = bodyweightKg ?? UNWEIGHTED_XP.defaultBodyweightKg;
  return { kind: 'fixed', kg: Math.round(fraction * bw * 10) / 10, usedDefault: bodyweightKg === null };
}
