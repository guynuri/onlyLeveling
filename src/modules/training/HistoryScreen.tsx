import { useEffect, useState } from 'react';
import { getExercise } from '../../data/exercises';
import type { BodyweightEntry, Workout } from '../../domain/types';
import { getRepo } from './data';
import { isIsoDate } from './validate';

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
      {workouts.length === 0 && <p className="muted">No finished sessions yet.</p>}
      <ul className="history">
        {workouts.map((w) => (
          <li key={w.id}>
            <strong>{new Date(w.start).toLocaleDateString()}</strong>
            <span className="muted">
              {' '}
              {w.entries.map((e) => `${getExercise(e.exerciseId)?.name ?? e.exerciseId} (${e.sets.length} sets)`).join(' · ')}
            </span>
          </li>
        ))}
      </ul>

      <h2>Bodyweight</h2>
      <div className="row">
        <label>
          Date
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
        <label>
          kg
          <input inputMode="decimal" value={kg} onChange={(e) => setKg(e.target.value)} />
        </label>
        <button type="button" onClick={addBw}>
          Add
        </button>
      </div>
      <p className="muted">{status}</p>
      <ul className="history">
        {bw.map((b) => (
          <li key={b.date}>
            {b.date} · {b.kg} kg
          </li>
        ))}
      </ul>
    </section>
  );
}
