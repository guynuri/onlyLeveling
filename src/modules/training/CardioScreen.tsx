// An extra cardio session (UX design §6.5): it earns XP but does not fill a slot in this week's target. Planned cardio
// days are logged from the workout screen.
import { useState } from 'react';
import { CARDIO } from '../../config/thresholds';
import { cardioXp, makeCardio, type CardioSession } from '../../domain/cardio';
import { Button, Card } from '../../ui/primitives';
import { getRepo } from './data';
import { CardioLog } from './CardioLog';

// The clock is read here, outside render.
const nowMs = () => Date.now();

export default function CardioScreen() {
  const [saved, setSaved] = useState<CardioSession | null>(null);
  const [round, setRound] = useState(0); // a fresh form for "Log another"

  if (saved) {
    return (
      <section className="ui-stack">
        <h1>Cardio logged</h1>
        <Card title={`${saved.minutes} min`}>
          <p>+{cardioXp(saved)} XP</p>
          <p className="muted small">Extra sessions earn XP but do not count toward this week’s target.</p>
        </Card>
        <Button
          block
          onClick={() => {
            setSaved(null);
            setRound(round + 1);
          }}
        >
          Log another
        </Button>
      </section>
    );
  }

  return (
    <section className="ui-stack">
      <h1>Log cardio</h1>
      <p className="muted small">For an extra session. A planned cardio day is logged from Train.</p>
      <CardioLog
        key={round}
        defaults={{ type: 'run', minutes: CARDIO.defaultMinutes }}
        onSave={async (v) => {
          const c = makeCardio(v, nowMs());
          await (await getRepo()).saveCardio(c);
          setSaved(c);
        }}
      />
    </section>
  );
}
