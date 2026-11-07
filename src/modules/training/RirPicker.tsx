// Reps left in reserve after a set, 0 to 4+ (UX design §6.4): five coloured buttons and one plain line for the one
// picked. Optional: tapping the picked level again clears it.
const LEVELS = [
  { value: 0, label: '0', line: 'Could not do another rep.' },
  { value: 1, label: '1', line: 'Could do 1 more rep.' },
  { value: 2, label: '2', line: 'Could do 2 more reps.' },
  { value: 3, label: '3', line: 'Could do 3 more reps.' },
  { value: 4, label: '4+', line: 'Plenty left: 4 or more reps.' },
] as const;

export function RirPicker(props: { value?: number; onChange: (v: number | undefined) => void; disabled?: boolean }) {
  const picked = LEVELS.find((l) => l.value === props.value);
  return (
    <div className="ui-rir">
      <div className="ui-rir-row" role="radiogroup" aria-label="Reps left in reserve">
        {LEVELS.map((l) => (
          <button
            key={l.value}
            type="button"
            role="radio"
            aria-checked={props.value === l.value}
            disabled={props.disabled}
            className={`ui-rir-btn ui-rir-btn--${l.value}`}
            onClick={() => props.onChange(props.value === l.value ? undefined : l.value)}
          >
            {l.label}
          </button>
        ))}
      </div>
      <p className="muted small ui-rir-line">{props.disabled ? 'After a set: how many reps were left? Optional.' : picked ? picked.line : 'How many reps were left? Optional.'}</p>
    </div>
  );
}
