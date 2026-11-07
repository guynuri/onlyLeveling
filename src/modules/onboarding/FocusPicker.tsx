// Focus muscles (owner decision 2026-11-07): up to FOCUS.max muscle groups the plan gives extra volume. A box per group
// with the body figure lit where that muscle is (owner request: boxes on the body, not chips).
import { FOCUS } from '../../config/thresholds';
import { GROUPS, GROUP_LABEL } from '../xp/domain/muscles';
import { GROUP_SLUGS } from '../xp/domain/hub';
import { BodyMap } from '../../ui/body/BodyMap';

export function FocusPicker(props: { value: readonly string[]; onChange: (v: string[]) => void; sex?: 'male' | 'female' }) {
  const toggle = (g: string) => {
    if (props.value.includes(g)) return props.onChange(props.value.filter((x) => x !== g));
    const next = [...props.value, g];
    // Past the limit, a new pick replaces the oldest one.
    props.onChange(next.length > FOCUS.max ? next.slice(next.length - FOCUS.max) : next);
  };
  return (
    <>
      <div className="focus-grid" role="group" aria-label="Focus muscles">
        {GROUPS.map((g) => (
          <button key={g} type="button" className="focus-box" aria-pressed={props.value.includes(g)} onClick={() => toggle(g)}>
            <BodyMap primary={GROUP_SLUGS[g]} size="sm" sex={props.sex} label={GROUP_LABEL[g]} />
            <span>{GROUP_LABEL[g]}</span>
          </button>
        ))}
      </div>
      <p className="muted small">
        Up to {FOCUS.max}. Each gets an extra exercise and an extra set in your plan. {props.value.length} picked.
      </p>
    </>
  );
}
