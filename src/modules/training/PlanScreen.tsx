import { useEffect, useState } from 'react';
import { listExercises } from '../../data/exercises';
import type { Plan } from '../../domain/plan';
import { getRepo, getLocalRepo, defaultSettings, currentPlan } from './data';
import { Card, EmptyState } from '../../ui/primitives';
import { Sheet } from '../../ui/controls';
import { PLAN_CHANGED_EVENT } from '../library/labels';
import { blockedIds, equipmentOf } from '../../domain/profile';
import type { EquipmentChoice, Settings } from '../../domain/types';
import { ProposePlan } from '../ai/ui/ProposePlan';
import { PlanHeader } from './PlanHeader';
import { DayEditor } from './DayEditor';
import { usePlanEditor } from './usePlanEditor';

// The saved plan. Warm-up and cool-down are shown as their own blocks, never as exercises.
export default function PlanScreen() {
  const [plan, setPlan] = useState<Plan | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [avoid, setAvoid] = useState<string[]>([]);
  const [equipment, setEquipment] = useState<EquipmentChoice[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [building, setBuilding] = useState(false);
  const [now] = useState(() => Date.now());
  const { edit, error: saveError } = usePlanEditor(plan, setPlan);

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

  return (
    <section>
      <h1>Plan</h1>
      {saveError && <p className="error">{saveError}</p>}
      <PlanHeader key={`${plan.block?.startedAt ?? 0}-${plan.days.length}`} plan={plan} now={now} onEdit={edit} onRegenerate={() => setBuilding(true)} />
      {plan.days.length !== settings.daysPerWeek && (
        <p className="muted small">
          Your plan has {plan.days.length} days; Settings says {settings.daysPerWeek} a week. Tap “New plan” to match.
        </p>
      )}
      <p className="muted small">
        Your plan. Change it however you like, or build a new one. Tap an exercise to see how it is done.
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
          <DayEditor plan={plan} day={day} equipment={equipment} blocked={avoid} onEdit={edit} />
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
