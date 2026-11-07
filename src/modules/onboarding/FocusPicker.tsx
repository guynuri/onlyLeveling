// Focus muscles (owner decision 2026-11-07): up to FOCUS.max muscle groups the plan gives extra volume. Used in
// onboarding and Settings.
import { FOCUS } from '../../config/thresholds';
import { GROUPS, GROUP_LABEL } from '../xp/domain/muscles';
import { ChipGroup } from '../../ui/primitives';

const OPTIONS = GROUPS.map((g) => ({ value: g as string, label: GROUP_LABEL[g] }));

export function FocusPicker(props: { value: readonly string[]; onChange: (v: string[]) => void }) {
  return (
    <>
      <ChipGroup
        label="Focus muscles"
        options={OPTIONS}
        value={props.value}
        // Past the limit, a new pick replaces the oldest one.
        onChange={(v) => props.onChange(v.length > FOCUS.max ? v.slice(v.length - FOCUS.max) : v)}
      />
      <p className="muted small">
        Up to {FOCUS.max}. Each gets an extra exercise and an extra set in your plan. {props.value.length} picked.
      </p>
    </>
  );
}
