import { useEffect, useState } from 'react';
import { getExercise } from '../../data/exercises';
import type { Plan } from '../../domain/plan';
import { getRepo, getLocalRepo, defaultSettings, currentPlan } from './data';

// The saved plan. Warm-up and cool-down are shown as their own blocks, never as exercises.
export default function PlanScreen() {
  const [plan, setPlan] = useState<Plan | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const repo = await getRepo();
      const s = (await repo.getSettings()) ?? defaultSettings();
      setPlan(await currentPlan(repo, await getLocalRepo(), s));
    })().catch(() => setError('Could not load your plan. Reload to try again.'));
  }, []);

  if (error) return <p className="muted">{error}</p>;
  if (!plan) return <p className="muted">Loading…</p>;

  return (
    <section>
      <h1>Plan</h1>
      <p className="muted">Your plan. It changes only when you accept a coach suggestion or change days per week. Dumbbell and bodyweight exercises only.</p>
      {plan.days.map((day) => (
        <div key={day.index} className="plan-day">
          <h2>Day {day.index + 1}</h2>
          <h3>Warm-up</h3>
          <ul>
            {day.warmup.map((r) => (
              <li key={r.name}>
                {r.name} · {Math.round(r.seconds / 60)} min
              </li>
            ))}
          </ul>
          <h3>Exercises</h3>
          <ol>
            {day.exerciseIds.map((id) => (
              <li key={id}>{getExercise(id)?.name ?? id}</li>
            ))}
          </ol>
          <h3>Cool-down</h3>
          <ul>
            {day.cooldown.map((r) => (
              <li key={r.name}>
                {r.name} · {Math.round(r.seconds / 60)} min
              </li>
            ))}
          </ul>
        </div>
      ))}
    </section>
  );
}
