// The controls for the next set: weight (snapped to owned weights), reps or seconds, and the ✓ that logs exactly what
// is shown. When the plan pre-filled the set, one tap on ✓ is all it takes (3-tap rule).
import { TRAINING, WORKOUT } from '../../config/thresholds';
import { Button } from '../../ui/primitives';
import { Stepper } from '../../ui/controls';
import { ArrowRight } from 'lucide-react';

export function SetControls(props: {
  mode: 'reps' | 'time';
  weighted: boolean; // false for bodyweight and band exercises: no weight stepper
  w: number;
  r: number;
  owned: readonly number[];
  onChange: (v: { w: number; r: number }) => void;
  onLog: () => void;
  onNext?: () => void; // all sets done: the main button moves on, logging an extra set becomes the small one
  setNumber: number; // 1-based, for the button label
  setsTotal: number;
}) {
  const timed = props.mode === 'time';
  return (
    <div className="ui-set-controls">
      <div className="ui-set-steppers">
        {props.weighted && (
          <div>
            <span className="muted small">Weight</span>
            <Stepper
              label="weight"
              unit="kg"
              value={props.w}
              values={props.owned.length > 0 ? props.owned : undefined}
              step={TRAINING.gridStepKg}
              min={0}
              onChange={(w) => props.onChange({ w, r: props.r })}
            />
          </div>
        )}
        <div>
          <span className="muted small">{timed ? 'Seconds' : 'Reps'}</span>
          <Stepper
            label={timed ? 'seconds' : 'reps'}
            unit={timed ? 's' : undefined}
            value={props.r}
            step={timed ? WORKOUT.timedStepSec : 1}
            min={1}
            max={timed ? WORKOUT.timedMaxSec : 50}
            onChange={(r) => props.onChange({ w: props.w, r })}
          />
        </div>
      </div>
      {props.onNext ? (
        <div className="ui-done-row">
          <Button variant="ghost" onClick={props.onLog}>
            + Extra set
          </Button>
          <Button className="ui-log ui-next" onClick={props.onNext} icon={<ArrowRight />}>
            Next exercise
          </Button>
        </div>
      ) : (
        <Button block className="ui-log" onClick={props.onLog}>
          {props.setNumber > props.setsTotal ? '✓ Log extra set' : `✓ Log set ${props.setNumber} of ${props.setsTotal}`}
        </Button>
      )}
    </div>
  );
}
