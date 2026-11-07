import { useEffect, useState } from 'react';
import { getExercise, listExercises } from '../../data/exercises';
import { BodyMap } from '../../ui/body/BodyMap';
import type { Plan } from '../../domain/plan';
import { getRepo, getLocalRepo, defaultSettings, currentPlan } from './data';
import { Button, Card, EmptyState } from '../../ui/primitives';
import { CARDIO } from '../../config/thresholds';
import { addCardioDay, removeDay } from '../../domain/plan-edit';
import { CardioDayEditor } from './CardioDayEditor';
import { Sheet } from '../../ui/controls';
import { PLAN_CHANGED_EVENT } from '../library/labels';
import { equipmentOf } from '../../domain/profile';
import type { EquipmentChoice, Settings } from '../../domain/types';
import { ProposePlan } from '../ai/ui/ProposePlan';
import { PlanHeader } from './PlanHeader';
import { DayEditor } from './DayEditor';
import { RoutineList } from './RoutineList';
import { usePlanEditor } from './usePlanEditor';
import { blockedFor } from '../progress/ranks-cache';

const minutesOf = (items: readonly { seconds: number }[]) => Math.round(items.reduce((s, r) => s + r.seconds, 0) / 60);

// Everything a day works, on one body figure: primary muscles strong, secondary light (owner request 2026-11-07).
function DayMuscles({ ids, sex }: { ids: readonly string[]; sex?: 'male' | 'female' }) {
  const exs = ids.map(getExercise).filter((e) => e !== undefined);
  const primary = [...new Set(exs.flatMap((e) => e.muscles.primary))];
  const secondary = [...new Set(exs.flatMap((e) => e.muscles.secondary))].filter((m) => !primary.includes(m));
  if (primary.length === 0) return null;
  return (
    <div className="day-map">
      <BodyMap primary={primary} secondary={secondary} sex={sex} size="sm" />
    </div>
  );
}

// The saved plan. Warm-up and cool-down are one folded line per day, never exercises.
export default function PlanScreen() {
  const [plan, setPlan] = useState<Plan | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [avoid, setAvoid] = useState<string[]>([]);
  const [equipment, setEquipment] = useState<EquipmentChoice[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [building, setBuilding] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState<number | null>(null);
  const [now] = useState(() => Date.now());
  const { edit, error: saveError } = usePlanEditor(plan, setPlan);

  useEffect(() => {
    const load = () =>
      (async () => {
        const repo = await getRepo();
        const s = (await repo.getSettings()) ?? defaultSettings();
        setSettings(s);
        setAvoid([...blockedFor(s, listExercises())]);
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

  const lifting = plan.days.filter((d) => d.kind !== 'cardio').length;
  // Remove a day after a second tap, so one slip does not drop it.
  const removeButton = (index: number) =>
    plan.days.length > 1 &&
    (confirmRemove === index ? (
      <Button size="sm" variant="danger" onClick={() => { setConfirmRemove(null); edit((p, at) => removeDay(p, index, at)); }}>
        Yes, remove this day
      </Button>
    ) : (
      <Button size="sm" variant="ghost" onClick={() => setConfirmRemove(index)}>
        Remove day
      </Button>
    ));

  return (
    <section>
      <h1>Plan</h1>
      {saveError && <p className="error">{saveError}</p>}
      <PlanHeader key={`${plan.block?.startedAt ?? 0}-${plan.days.length}`} plan={plan} now={now} onEdit={edit} onRegenerate={() => setBuilding(true)} />
      {lifting !== settings.daysPerWeek && (
        <p className="muted small">
          Your plan has {lifting} lifting {lifting === 1 ? 'day' : 'days'}; Settings says {settings.daysPerWeek} a week. Tap “New plan” to match.
        </p>
      )}
      {plan.days.map((day) =>
        day.kind === 'cardio' ? (
          <Card key={day.index} title={day.label ?? 'Cardio'}>
            <p className="muted small">A cardio day. Logging it from Train counts toward the week’s target.</p>
            <CardioDayEditor day={day} onEdit={edit} />
            {removeButton(day.index)}
          </Card>
        ) : (
        <Card
          key={day.index}
          title={day.label ?? `Day ${day.index + 1}`}
          action={<span className="muted small">{day.exerciseIds.length} exercises</span>}
        >
          <DayMuscles ids={day.exerciseIds} sex={settings.about?.sex} />
          <details className="pe-routine">
            <summary className="muted small">
              Warm-up {minutesOf(day.warmup)} min · cool-down {minutesOf(day.cooldown)} min
              {day.postCardioMinutes ? ` · cardio after ${day.postCardioMinutes} min` : ''}
              {day.mobilityMinutes ? ` · mobility ${day.mobilityMinutes} min` : ''}
            </summary>
            <RoutineList items={day.warmup} part="Warm-up" />
            <RoutineList items={day.cooldown} part="Cool-down" />
            {day.mobility && <RoutineList items={day.mobility} part="Mobility" />}
          </details>
          <DayEditor plan={plan} day={day} equipment={equipment} blocked={avoid} onEdit={edit} />
          {removeButton(day.index)}
        </Card>
        ),
      )}
      <Button variant="secondary" onClick={() => edit((p, at) => addCardioDay(p, { type: 'walk', minutes: CARDIO.defaultMinutes }, at))}>
        Add cardio day
      </Button>
      <Sheet open={building} onClose={() => setBuilding(false)} title="New plan">
        <ProposePlan settings={settings} onSaved={built} />
      </Sheet>
    </section>
  );
}
