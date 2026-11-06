import { useEffect, useState } from 'react';
import { getExercise, listExercises } from '../../data/exercises';
import { replaceExercise, planExerciseIds, type Plan } from '../../domain/plan';
import { isDumbbellCompatible, movementPattern } from '../../domain/exercise';
import { getRepo, getLocalRepo, defaultSettings, currentPlan } from './data';
import { ExerciseName } from '../library/ExerciseSheet';

// Saves a plan with one exercise replaced. The clock is read here, outside render.
async function replaceAndSave(plan: Plan, fromId: string, toId: string): Promise<Plan> {
  const next = replaceExercise(plan, fromId, toId, Date.now());
  await (await getRepo()).savePlan(next);
  return next;
}

// The saved plan. Warm-up and cool-down are shown as their own blocks, never as exercises.
export default function PlanScreen() {
  const [plan, setPlan] = useState<Plan | null>(null);
  const [avoid, setAvoid] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const repo = await getRepo();
      const s = (await repo.getSettings()) ?? defaultSettings();
      setAvoid(s.avoid ?? []);
      setPlan(await currentPlan(repo, await getLocalRepo(), s));
    })().catch(() => setError('Could not load your plan. Reload to try again.'));
  }, []);

  if (error) return <p className="muted">{error}</p>;
  if (!plan) return <p className="muted">Loading…</p>;

  const inPlan = new Set(planExerciseIds(plan));
  // Replacement choices: dumbbell-compatible, known pattern, not already in the plan, not avoided (SPEC §3.1).
  const choices = listExercises().filter(
    (ex) => isDumbbellCompatible(ex) && movementPattern(ex) !== 'unknown' && !inPlan.has(ex.id) && !avoid.includes(ex.id),
  );

  const replace = async (fromId: string, toId: string) => {
    setSaveError(null);
    try {
      setPlan(await replaceAndSave(plan, fromId, toId));
    } catch {
      setSaveError('Could not replace that exercise. Try again.');
    }
  };

  return (
    <section>
      <h1>Plan</h1>
      {saveError && <p className="error">{saveError}</p>}
      <p className="muted">
        Your plan. It changes when you accept a coach suggestion, replace an exercise, or change days per week. Dumbbell
        and bodyweight exercises only.
      </p>
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
              <li key={id}>
                <ExerciseName id={id} name={getExercise(id)?.name ?? id} />{' '}
                <label className="small">
                  Replace with{' '}
                  <select value="" onChange={(e) => e.target.value && replace(id, e.target.value)} aria-label={`Replace ${getExercise(id)?.name ?? id}`}>
                    <option value="">Choose…</option>
                    {choices.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </label>
              </li>
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
