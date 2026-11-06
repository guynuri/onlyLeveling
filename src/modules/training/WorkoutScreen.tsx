import { useEffect, useState } from 'react';
import { getExercise } from '../../data/exercises';
import { type TemplateDay } from '../../domain/template';
import { activeAdjustment } from '../../domain/plan';
import { CoachCards } from '../coach/CoachCards';
import { nextPrescription, type Prescription } from '../../domain/progression';
import type { SetRow } from '../../domain/session';
import type { Settings, Workout, Entry } from '../../domain/types';
import { startRest, remainingMs, type RestTimer } from './rest-timer';
import { scheduleRestAlert, cancelRestAlert } from '../push/actions';
import { getRepo, getLocalRepo, defaultSettings, historyFor, progressionConfigFor, currentPlan } from './data';
import { parseSetInput, todayFromTemplate } from './validate';

interface ExercisePlan {
  exerciseId: string;
  prescription: Prescription;
  sets: SetRow[];
  weight: string;
  reps: string;
}

// Today's session: the next day of the plan. Warm-up and cool-down are shown, not logged as sets.
export default function WorkoutScreen() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [exercises, setExercises] = useState<ExercisePlan[]>([]);
  const [day, setDay] = useState<TemplateDay | null>(null);
  const [start, setStart] = useState<number>(() => Date.now());
  const [rest, setRest] = useState<RestTimer | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [status, setStatus] = useState('');
  const [loadError, setLoadError] = useState<string | null>(null);

  // Load settings, history and today's day. Any failure is shown, never left as a silent "Loading…".
  useEffect(() => {
    (async () => {
      const repo = await getRepo();
      const s = (await repo.getSettings()) ?? defaultSettings();
      const ws = await repo.listWorkouts();
      const plan = await currentPlan(repo, await getLocalRepo(), s);
      const today = todayFromTemplate(plan, ws.length);
      if (!today) {
        setLoadError('No plan days yet. Check the days per week in Settings.');
        return;
      }
      setSettings(s);
      setWorkouts(ws);
      setDay(today);
      setExercises(
        today.exerciseIds.map((id) => {
          const ex = getExercise(id)!;
          const next = nextPrescription(historyFor(ws, id), progressionConfigFor(ex, s.owned));
          // An accepted coach change sets the weight for this session only (plan.ts activeAdjustment).
          const adj = activeAdjustment(plan, id, ws);
          const p = adj === null ? next : { ...next, w: adj };
          return { exerciseId: id, prescription: p, sets: [], weight: String(p.w), reps: String(p.reps) };
        }),
      );
      setStart(Date.now());
    })().catch(() => setLoadError('Could not load today’s session. Reload the page to try again.'));
  }, []);

  // Tick once a second while a rest runs, so the countdown shows (wall-clock based, see rest-timer.ts).
  useEffect(() => {
    if (!rest) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [rest]);

  if (loadError) return <p className="muted">{loadError}</p>;
  if (!settings || !day) return <p className="muted">Loading…</p>;

  function logSet(index: number) {
    const ex = exercises[index];
    const parsed = parseSetInput(ex.weight, ex.reps);
    if (!parsed.ok) {
      setStatus(parsed.error); // refused: nothing is logged as done
      return;
    }
    setStatus('');
    const at = Date.now();
    const row: SetRow = { w: parsed.value.w, r: parsed.value.r, done: true, phase: 'work', at };
    setExercises((prev) => prev.map((e, i) => (i === index ? { ...e, sets: [...e.sets, row] } : e)));
    const timer = startRest(at, settings!.restSec);
    setRest(timer);
    setNow(at);
    // The rest-end push (PLAN Phase 9). The on-screen timer runs either way; a failure is said, not hidden.
    if (timer) {
      scheduleRestAlert(timer.endsAt).catch((e: unknown) =>
        setStatus(`Rest alert not scheduled: ${e instanceof Error ? e.message : 'unknown error'}`),
      );
    } else {
      // Rest is off: an alert from an earlier set must not fire now.
      cancelRestAlert().catch(() => undefined);
    }
  }

  function update(index: number, field: 'weight' | 'reps', value: string) {
    setExercises((prev) => prev.map((ex, i) => (i === index ? { ...ex, [field]: value } : ex)));
  }

  async function finish() {
    const entries: Entry[] = exercises
      .filter((ex) => ex.sets.length > 0)
      .map((ex) => ({ exerciseId: ex.exerciseId, planned: ex.prescription, sets: ex.sets }));
    if (entries.length === 0) {
      setStatus('Log at least one set first.');
      return;
    }
    const workout: Workout = { id: `w_${start}`, start, end: Date.now(), entries };
    const repo = await getRepo();
    await repo.saveWorkout(workout);
    // A finished workout ends any pending rest alert. A failed cancel must not block saving, so it is ignored.
    cancelRestAlert().catch(() => undefined);
    setWorkouts([workout, ...workouts]);
    setStatus('Saved on this device. Last synced: never.');
    setExercises([]);
  }

  const restLeft = rest ? Math.ceil(remainingMs(rest, now) / 1000) : 0;

  return (
    <section>
      <h1>Today · Day {(workouts.length % settings.daysPerWeek) + 1}</h1>
      <CoachCards />
      <p className="small">
        <a href="#/progress">Progress and XP</a>
      </p>

      <h3>Warm-up</h3>
      <ul className="routine">
        {day.warmup.map((r) => (
          <li key={r.name}>
            {r.name} · {Math.round(r.seconds / 60)} min
          </li>
        ))}
      </ul>

      {rest && restLeft > 0 && (
        <div className="rest" role="timer" aria-live="off">
          Rest {Math.floor(restLeft / 60)}:{String(restLeft % 60).padStart(2, '0')}
        </div>
      )}

      {exercises.map((ex, i) => {
        const name = getExercise(ex.exerciseId)?.name ?? ex.exerciseId;
        return (
          <article key={ex.exerciseId} className="exercise-card">
            <h2>{name}</h2>
            <p className="muted">
              Target {ex.prescription.sets} × {ex.prescription.reps} at {ex.prescription.w} kg
            </p>
            <div className="row">
              <label>
                kg
                <input
                  inputMode="decimal"
                  value={ex.weight}
                  onChange={(e) => update(i, 'weight', e.target.value)}
                />
              </label>
              <label>
                reps
                <input inputMode="numeric" value={ex.reps} onChange={(e) => update(i, 'reps', e.target.value)} />
              </label>
              <button type="button" className="log" onClick={() => logSet(i)}>
                Log set ({ex.sets.length}/{ex.prescription.sets})
              </button>
            </div>
          </article>
        );
      })}

      <h3>Cool-down</h3>
      <ul className="routine">
        {day.cooldown.map((r) => (
          <li key={r.name}>
            {r.name} · {Math.round(r.seconds / 60)} min
          </li>
        ))}
      </ul>

      <button type="button" onClick={finish}>
        Finish workout
      </button>
      <p className="muted">{status}</p>
    </section>
  );
}
