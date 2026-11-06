import { useEffect, useState } from 'react';
import { getExercise } from '../../data/exercises';
import type { BodyweightEntry, Workout } from '../../domain/types';
import { getRepo } from './data';
import { isIsoDate } from './validate';
import { ExerciseName } from '../library/ExerciseSheet';
import { Dumbbell } from 'lucide-react';
import { Button, Card, EmptyState } from '../../ui/primitives';

const minutes = (w: Workout) => Math.max(1, Math.round((w.end - w.start) / 60000));

// Past sessions, plus the bodyweight log (SPEC §2: bodyweight is logged over time).
export default function HistoryScreen() {
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [bw, setBw] = useState<BodyweightEntry[]>([]);
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [kg, setKg] = useState('');
  const [status, setStatus] = useState('');

  useEffect(() => {
    getRepo().then(async (r) => {
      setWorkouts(await r.listWorkouts());
      setBw(await r.listBodyweight());
    });
  }, []);

  async function addBw() {
    const value = Number(kg);
    if (!isIsoDate(date)) {
      setStatus('Enter a date.');
      return;
    }
    if (!(value > 0)) {
      setStatus('Enter a weight in kg.');
      return;
    }
    try {
      const repo = await getRepo();
      await repo.addBodyweight(date, value);
      setBw(await repo.listBodyweight());
      setKg('');
      setStatus('Saved on this device.');
    } catch {
      setStatus('Could not save. Try again.');
    }
  }

  return (
    <section>
      <h1>History</h1>
      {workouts.length === 0 && (
        <EmptyState
          icon={<Dumbbell />}
          title="No finished sessions yet"
          body="Your workouts show up here after you finish them."
          action={
            <a className="ui-btn ui-btn--primary ui-btn--md" href="#/workout">
              Start a workout
            </a>
          }
        />
      )}
      {workouts.map((w) => (
        <Card key={w.id} title={new Date(w.start).toLocaleDateString()} action={<span className="muted small">{minutes(w)} min</span>}>
          <ul className="ui-list">
            {w.entries.map((e) => (
              <li key={e.exerciseId}>
                <ExerciseName id={e.exerciseId} name={getExercise(e.exerciseId)?.name ?? e.exerciseId} />
                <span className="muted small">{e.sets.length} sets</span>
              </li>
            ))}
          </ul>
        </Card>
      ))}

      <Card title="Bodyweight">
        <div className="row">
          <label>
            Date
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </label>
          <label>
            kg
            <input inputMode="decimal" value={kg} onChange={(e) => setKg(e.target.value)} />
          </label>
          <Button onClick={addBw}>Add</Button>
        </div>
        <p className="muted small" role="status">
          {status}
        </p>
        <ul className="ui-list">
          {bw.map((b) => (
            <li key={b.date}>
              <span>{b.date}</span>
              <span className="muted">{b.kg} kg</span>
            </li>
          ))}
        </ul>
      </Card>
    </section>
  );
}
