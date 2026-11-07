import { useEffect, useState } from 'react';
import { getExercise } from '../../data/exercises';
import type { Workout } from '../../domain/types';
import { getRepo } from './data';
import { ExerciseName } from '../library/ExerciseSheet';
import { Dumbbell } from 'lucide-react';
import { Card, EmptyState } from '../../ui/primitives';

const minutes = (w: Workout) => Math.max(1, Math.round((w.end - w.start) / 60000));

// Past sessions. Bodyweight is logged on Progress (UX design §6.6).
export default function HistoryScreen() {
  const [workouts, setWorkouts] = useState<Workout[]>([]);

  useEffect(() => {
    getRepo().then(async (r) => {
      setWorkouts(await r.listWorkouts());
    });
  }, []);

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

    </section>
  );
}
