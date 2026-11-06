// One −/+ tap on a Stepper. With an owned list it moves to the neighbouring owned weight (and stays at either
// end); otherwise it adds the numeric step. The result is always inside [min, max]. Pure, tested.
import { stepOwned } from '../domain/dumbbells';

export function stepValue(
  current: number,
  dir: 1 | -1,
  opts: { values?: readonly number[]; step?: number; min?: number; max?: number },
): number {
  const next = opts.values && opts.values.length > 0 ? stepOwned(opts.values, current, dir) : current + dir * (opts.step ?? 1);
  return Math.min(opts.max ?? Infinity, Math.max(opts.min ?? 0, next));
}

// Whether a tap would change the value: false at a limit, so that button is disabled.
export function canStep(current: number, dir: 1 | -1, opts: Parameters<typeof stepValue>[2]): boolean {
  return stepValue(current, dir, opts) !== current;
}
