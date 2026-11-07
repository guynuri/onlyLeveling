// How the last set felt, on one slider (owner request 2026-11-07): below zero = fell short by that many reps, 0 = could
// not do another, 1 to 4+ = reps left in reserve. Optional; Clear removes the rating. live-session.ts rateSet applies it.
import { useId } from 'react';
import { WORKOUT } from '../../config/thresholds';

const MAX = 4;

export function effortLine(v: number): string {
  if (v <= -WORKOUT.missMax) return `Fell short by ${WORKOUT.missMax} or more reps.`;
  if (v < 0) return `Fell short by ${-v} ${v === -1 ? 'rep' : 'reps'}.`;
  if (v === 0) return 'Could not do another rep.';
  if (v >= MAX) return 'Plenty left: 4 or more reps.';
  return `Could do ${v} more ${v === 1 ? 'rep' : 'reps'}.`;
}

const label = (v: number) => (v === MAX ? '4+' : v <= -WORKOUT.missMax ? `−${WORKOUT.missMax}` : v < 0 ? `−${-v}` : String(v));

export function RirPicker(props: { value?: number; onChange: (v: number | undefined) => void; disabled?: boolean }) {
  const lineId = useId();
  const unset = props.value === undefined;
  const ticks = Array.from({ length: MAX + WORKOUT.missMax + 1 }, (_, i) => i - WORKOUT.missMax);
  return (
    <div className={`ui-effort${unset ? ' ui-effort--unset' : ''}`}>
      <div className="ui-effort-head">
        <span className="small">How did that set feel?</span>
        {!unset && !props.disabled && (
          <button type="button" className="ui-effort-clear" onClick={() => props.onChange(undefined)}>
            Clear
          </button>
        )}
      </div>
      <input
        type="range"
        className="ui-effort-range"
        min={-WORKOUT.missMax}
        max={MAX}
        step={1}
        value={props.value ?? 0}
        disabled={props.disabled}
        aria-label="Reps left, or reps short"
        aria-valuetext={unset ? 'Not rated' : effortLine(props.value!)}
        aria-describedby={lineId}
        onChange={(e) => props.onChange(Number(e.target.value))}
      />
      <div className="ui-effort-ticks" aria-hidden="true">
        {ticks.map((t) => (
          <span key={t} className={t === props.value ? 'on' : undefined}>
            {label(t)}
          </span>
        ))}
      </div>
      <p id={lineId} className="muted small ui-rir-line">
        {props.disabled ? 'Log a set of this exercise, then slide to rate it.' : unset ? 'Optional: slide left if you fell short, right if reps were left.' : effortLine(props.value!)}
      </p>
    </div>
  );
}
