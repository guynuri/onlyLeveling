import { useEffect, useState } from 'react';
import { getExercise, listExercises } from '../../data/exercises';
import { replaceExercise, planExerciseIds, type Plan } from '../../domain/plan';
import { movementPattern, usableWith } from '../../domain/exercise';
import { getRepo, getLocalRepo, defaultSettings, currentPlan } from './data';
import { ExerciseName } from '../library/ExerciseSheet';
import { Card } from '../../ui/primitives';
import { PLAN_CHANGED_EVENT } from '../library/labels';
import { blockedIds, equipmentOf } from '../../domain/profile';
import type { EquipmentChoice } from '../../domain/types';

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
  const [equipment, setEquipment] = useState<EquipmentChoice[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    const load = () =>
      (async () => {
        const repo = await getRepo();
        const s = (await repo.getSettings()) ?? defaultSettings();
        setAvoid([...blockedIds(s, listExercises())]);
        setEquipment(equipmentOf(s));
        setPlan(await currentPlan(repo, await getLocalRepo(), s));
      })().catch(() => setError('Could not load your plan. Reload to try again.'));
    load();
    // A swap from the exercise sheet saves the plan behind this screen.
    window.addEventListener(PLAN_CHANGED_EVENT, load);
    return () => window.removeEventListener(PLAN_CHANGED_EVENT, load);
  }, []);

  if (error) return <p className="muted">{error}</p>;
  if (!plan) return <p className="muted">Loading…</p>;

  const inPlan = new Set(planExerciseIds(plan));
  // Replacement choices: usable with the owned equipment, known pattern, not already in the plan, not avoided (SPEC §3.1).
  const choices = listExercises().filter(
    (ex) => usableWith(ex, equipment) && movementPattern(ex) !== 'unknown' && !inPlan.has(ex.id) && !avoid.includes(ex.id),
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
      <p className="muted small">
        Your plan. It changes when you accept a coach suggestion, replace an exercise, or change days per week. Tap an
        exercise to see how it is done.
      </p>
      {plan.days.map((day) => (
        <Card key={day.index} title={`Day ${day.index + 1}`}>
          <h3>Warm-up</h3>
          <ul className="ui-list">
            {day.warmup.map((r) => (
              <li key={r.name}>
                <span>{r.name}</span>
                <span className="muted small">{Math.round(r.seconds / 60)} min</span>
              </li>
            ))}
          </ul>
          <h3>Exercises</h3>
          <ol className="ui-list ui-list--numbered">
            {day.exerciseIds.map((id) => (
              <li key={id} className="ui-list-stack">
                <ExerciseName id={id} name={getExercise(id)?.name ?? id} />
                <select
                  className="ui-select-sm"
                  value=""
                  onChange={(e) => e.target.value && replace(id, e.target.value)}
                  aria-label={`Replace ${getExercise(id)?.name ?? id}`}
                >
                  <option value="">Replace with…</option>
                  {choices.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </li>
            ))}
          </ol>
          <h3>Cool-down</h3>
          <ul className="ui-list">
            {day.cooldown.map((r) => (
              <li key={r.name}>
                <span>{r.name}</span>
                <span className="muted small">{Math.round(r.seconds / 60)} min</span>
              </li>
            ))}
          </ul>
        </Card>
      ))}
    </section>
  );
}
