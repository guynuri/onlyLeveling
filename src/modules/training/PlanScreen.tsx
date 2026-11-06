import { useEffect, useState } from 'react';
import { getExercise, listExercises } from '../../data/exercises';
import { replaceExercise, planExerciseIds, type Plan } from '../../domain/plan';
import { usableWith, movementPattern } from '../../domain/exercise';
import { getRepo, getLocalRepo, defaultSettings, currentPlan } from './data';
import { ExerciseName } from '../library/ExerciseSheet';
import { Card, EmptyState } from '../../ui/primitives';
import { Sheet } from '../../ui/controls';
import { PLAN_CHANGED_EVENT } from '../library/labels';
import { blockedIds, equipmentOf } from '../../domain/profile';
import type { EquipmentChoice, Settings } from '../../domain/types';
import { ProposePlan } from '../ai/ui/ProposePlan';
import { PlanHeader } from './PlanHeader';

// Saves a plan with one exercise replaced. The clock is read here, outside render.
async function replaceAndSave(plan: Plan, fromId: string, toId: string): Promise<Plan> {
  const next = replaceExercise(plan, fromId, toId, Date.now());
  await (await getRepo()).savePlan(next);
  return next;
}

// Applies an edit made with the clock read here, and saves it when it changed anything.
async function saveEdit(plan: Plan, edit: (now: number) => Plan): Promise<Plan> {
  const next = edit(Date.now());
  if (next !== plan) await (await getRepo()).savePlan(next);
  return next;
}

const range = (t: { repMin: number; repMax: number }) => (t.repMin === t.repMax ? `${t.repMin}` : `${t.repMin}–${t.repMax}`);

// The saved plan. Warm-up and cool-down are shown as their own blocks, never as exercises.
export default function PlanScreen() {
  const [plan, setPlan] = useState<Plan | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [avoid, setAvoid] = useState<string[]>([]);
  const [equipment, setEquipment] = useState<EquipmentChoice[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [building, setBuilding] = useState(false);
  const [now] = useState(() => Date.now());

  useEffect(() => {
    const load = () =>
      (async () => {
        const repo = await getRepo();
        const s = (await repo.getSettings()) ?? defaultSettings();
        setSettings(s);
        setAvoid([...blockedIds(s, listExercises())]);
        setEquipment(equipmentOf(s));
        setPlan(await currentPlan(repo, await getLocalRepo(), s));
      })().catch(() => setError('Could not load your plan. Reload to try again.'));
    load();
    // A swap from the exercise sheet, or a new plan from the builder, saves the plan behind this screen.
    window.addEventListener(PLAN_CHANGED_EVENT, load);
    return () => window.removeEventListener(PLAN_CHANGED_EVENT, load);
  }, []);

  if (error) return <p className="muted">{error}</p>;
  if (!plan || !settings) return <p className="muted">Loading…</p>;

  const built = () => {
    setBuilding(false);
    window.dispatchEvent(new Event(PLAN_CHANGED_EVENT));
  };

  if (plan.days.length === 0) {
    return (
      <section>
        <h1>Plan</h1>
        <EmptyState title="No plan yet" body="Generate one with the AI or start from a template." />
        <ProposePlan settings={settings} onSaved={built} />
      </section>
    );
  }

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

  const edit = async (fn: (now: number) => Plan) => {
    setSaveError(null);
    try {
      setPlan(await saveEdit(plan, fn));
    } catch {
      setSaveError('Could not save that change. Try again.');
    }
  };

  return (
    <section>
      <h1>Plan</h1>
      {saveError && <p className="error">{saveError}</p>}
      <PlanHeader plan={plan} now={now} onEdit={edit} onRegenerate={() => setBuilding(true)} />
      {plan.days.length !== settings.daysPerWeek && (
        <p className="muted small">
          Your plan has {plan.days.length} days; Settings says {settings.daysPerWeek} a week. Tap “New plan” to match.
        </p>
      )}
      <p className="muted small">
        Your plan. It changes when you accept a coach suggestion, replace an exercise, or build a new plan. Tap an exercise to
        see how it is done.
      </p>
      {plan.days.map((day) => (
        <Card key={day.index} title={day.label ?? `Day ${day.index + 1}`}>
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
                <span>
                  <ExerciseName id={id} name={getExercise(id)?.name ?? id} />
                  {day.targets?.[id] && (
                    <span className="muted small">
                      {' '}
                      · {day.targets[id].sets} × {range(day.targets[id])}
                    </span>
                  )}
                </span>
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
          {(day.postCardioMinutes || day.mobilityMinutes) && (
            <p className="muted small">
              {day.postCardioMinutes ? `Cardio after lifting: ${day.postCardioMinutes} min. ` : ''}
              {day.mobilityMinutes ? `Mobility: ${day.mobilityMinutes} min.` : ''}
            </p>
          )}
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
      <Sheet open={building} onClose={() => setBuilding(false)} title="New plan">
        <ProposePlan settings={settings} onSaved={built} />
      </Sheet>
    </section>
  );
}
