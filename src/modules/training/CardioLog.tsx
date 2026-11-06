// The cardio form (UX design §6.5): type, minutes, optional distance and effort. Pre-filled, so a planned session is
// one tap. Shows the XP it will earn. Training guidance only: effort is how hard it felt, 1 easy to 10 all out.
import { useState } from 'react';
import { CARDIO } from '../../config/thresholds';
import { cardioXp, parseCardio, type CardioSession, type CardioType } from '../../domain/cardio';
import { Button, Chip } from '../../ui/primitives';
import { Stepper } from '../../ui/controls';

export function CardioTypePicker(props: { value: CardioType; onChange: (t: CardioType) => void }) {
  return (
    <div className="ui-chips" role="radiogroup" aria-label="Cardio type">
      {CARDIO.types.map((t) => (
        <Chip key={t.value} selected={props.value === t.value} onToggle={() => props.onChange(t.value)}>
          {t.label}
        </Chip>
      ))}
    </div>
  );
}

type Values = Pick<CardioSession, 'type' | 'minutes' | 'distanceKm' | 'effort'>;

export function CardioLog(props: {
  defaults: { type: CardioType; minutes: number };
  saveLabel?: string;
  onSave: (v: Values) => Promise<void>;
}) {
  const [type, setType] = useState<CardioType>(props.defaults.type);
  const [minutes, setMinutes] = useState(props.defaults.minutes);
  const [distance, setDistance] = useState(0); // 0 = none
  const [effort, setEffort] = useState<number>(CARDIO.defaultEffort);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const save = async () => {
    const parsed = parseCardio({ type, minutes, distanceKm: distance > 0 ? distance : null, effort });
    if (!parsed.ok) {
      setError(parsed.error);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await props.onSave(parsed.value);
    } catch {
      setError('Could not save the cardio session. Nothing was lost: try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="ui-stack">
      <CardioTypePicker value={type} onChange={setType} />
      <div className="ui-row ui-fields">
        <div>
          <span className="muted small">Minutes</span>
          <Stepper label="minutes" value={minutes} step={CARDIO.minutesStep} min={1} max={CARDIO.minutesMax} onChange={setMinutes} />
        </div>
        <div>
          <span className="muted small">Distance (optional)</span>
          <Stepper label="distance" unit="km" value={distance} step={CARDIO.distanceStep} min={0} max={CARDIO.distanceMax} onChange={setDistance} />
        </div>
        <div>
          <span className="muted small">Effort (1 easy, 10 all out)</span>
          <Stepper label="effort" value={effort} min={1} max={10} onChange={setEffort} />
        </div>
      </div>
      {error && <p className="error">{error}</p>}
      <Button block className="ui-log" onClick={save} disabled={busy}>
        {props.saveLabel ?? 'Log cardio'} · +{cardioXp({ minutes, effort })} XP
      </Button>
    </div>
  );
}
