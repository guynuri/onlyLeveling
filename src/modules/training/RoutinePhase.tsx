// Warm-up or cool-down as its own step of the session (owner request 2026-11-07): the items run one after another on
// a wall-clock timer (routine-clock.ts), each can be skipped, and the main button moves on whenever the user is ready.
import { useEffect, useState } from 'react';
import { SkipForward } from 'lucide-react';
import type { RoutineItem } from '../../domain/template';
import { routineAt, skipMs } from '../../domain/routine-clock';
import { getExercise } from '../../data/exercises';
import { ExerciseName } from '../library/ExerciseSheet';
import { ExerciseMedia } from '../../ui/ExerciseMedia';
import { Button, Card } from '../../ui/primitives';
import { duration } from './RoutineList';

const clock = () => Date.now();
const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

export function RoutinePhase(props: { title: string; items: readonly RoutineItem[]; doneLabel: string; onDone: () => void }) {
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [shift, setShift] = useState(0); // skipped time
  const [now, setNow] = useState(clock);
  useEffect(() => {
    if (startedAt === null) return;
    const t = setInterval(() => setNow(clock()), 1000);
    return () => clearInterval(t);
  }, [startedAt]);

  const elapsed = startedAt === null ? 0 : now - startedAt + shift;
  const at = routineAt(props.items, elapsed);
  const finished = at.index >= props.items.length;
  const current = props.items[at.index];
  const ex = current?.exerciseId ? getExercise(current.exerciseId) : undefined;

  return (
    <section className="ui-stack">
      <h1>{props.title}</h1>
      {!finished && current && (
        <Card className="ui-live ui-live--current rp-current">
          <p className="muted small">
            {at.index + 1} of {props.items.length}
          </p>
          <h2>{current.exerciseId ? <ExerciseName id={current.exerciseId} name={current.name} /> : current.name}</h2>
          {ex?.media && (
            <div className="ui-live-media">
              <ExerciseMedia media={ex.media} name={ex.name} />
            </div>
          )}
          <p className="rp-time" aria-live="polite">
            {startedAt === null ? duration(current.seconds) : mmss(at.left)}
          </p>
          {startedAt === null ? (
            <Button block onClick={() => {
              const t = clock();
              setStartedAt(t);
              setNow(t);
            }}>
              Start timer
            </Button>
          ) : (
            <Button variant="ghost" icon={<SkipForward />} onClick={() => setShift(shift + skipMs(props.items, elapsed))}>
              Next
            </Button>
          )}
        </Card>
      )}
      {finished && <p className="muted">All done.</p>}
      <ol className="ui-list ui-list--numbered">
        {props.items.map((r, i) => (
          <li key={(r.exerciseId ?? r.name) + i} className={i < at.index ? 'rp-done' : i === at.index ? 'rp-now' : undefined}>
            <span>{r.name}</span>
            <span className="muted small">{duration(r.seconds)}</span>
          </li>
        ))}
      </ol>
      <Button block className="ui-log" onClick={props.onDone}>
        {props.doneLabel}
      </Button>
    </section>
  );
}
