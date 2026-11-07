// After Finish (UX design §6.4): how long, how much, any records, the XP earned, the muscles worked and any rank-ups.
import type { ReactNode } from 'react';
import { Button, Card, RankBadge } from '../../ui/primitives';
import { BodyMap } from '../../ui/body/BodyMap';
import type { SessionSummary } from '../xp/domain/sessionSummary';

const GROUP_LABEL: Record<string, string> = {
  chest: 'Chest',
  back: 'Back',
  shoulders: 'Shoulders',
  biceps: 'Biceps',
  triceps: 'Triceps',
  quads: 'Quads',
  hamstrings: 'Hamstrings',
  glutes: 'Glutes',
  calves: 'Calves',
  core: 'Core',
};

export function FinishSummary(props: {
  summary: SessionSummary;
  names: Record<string, string>; // exercise id → name
  sex: 'male' | 'female';
  onDone: () => void;
  extra?: ReactNode; // e.g. the post-lift cardio card, shown above Done
}) {
  const s = props.summary;
  return (
    <section className="ui-stack">
      <h1>Session done</h1>
      <Card title="This session">
        <ul className="ui-list">
          <li>
            <span>Time</span>
            <span>{s.minutes} min</span>
          </li>
          <li>
            <span>Volume</span>
            <span>{Math.round(s.volumeKg).toLocaleString()} kg</span>
          </li>
          <li>
            <span>XP earned</span>
            <span>+{Math.round(s.xpTotal).toLocaleString()}</span>
          </li>
        </ul>
      </Card>
      {s.usedDefaultBodyweight && (
        <p className="muted small">Log your weight in Progress so bodyweight sets earn exact XP.</p>
      )}
      {s.prExerciseIds.length > 0 && (
        <Card title="New records">
          <ul className="ui-list">
            {s.prExerciseIds.map((id) => (
              <li key={id}>{props.names[id] ?? id}</li>
            ))}
          </ul>
        </Card>
      )}
      {s.rankUps.length > 0 && (
        <Card title="Rank up">
          <ul className="ui-list">
            {s.rankUps.map((r) => (
              <li key={r.group}>
                <span>{GROUP_LABEL[r.group] ?? r.group}</span>
                <span>
                  <RankBadge rank={r.from} /> → <RankBadge rank={r.to} />
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}
      <Card title="Muscles worked">
        <BodyMap primary={s.primary} secondary={s.secondary} sex={props.sex} />
      </Card>
      {props.extra}
      <Button block onClick={props.onDone}>
        Done
      </Button>
    </section>
  );
}
