// Edit a standalone cardio day in the plan: its type and minutes (UX design §6.5). Changes go out as pure plan edits.
import { CARDIO } from '../../config/thresholds';
import type { Plan } from '../../domain/plan';
import { setCardioDay } from '../../domain/plan-edit';
import type { TemplateDay } from '../../domain/template';
import { Stepper } from '../../ui/controls';
import { CardioTypePicker } from './CardioLog';

export function CardioDayEditor(props: { day: TemplateDay; onEdit: (edit: (plan: Plan, now: number) => Plan) => void }) {
  const cardio = props.day.cardio ?? { type: 'walk' as const, minutes: CARDIO.defaultMinutes };
  const i = props.day.index;
  return (
    <div className="ui-stack">
      <CardioTypePicker value={cardio.type} onChange={(type) => props.onEdit((p, now) => setCardioDay(p, i, { ...cardio, type }, now))} />
      <div className="ui-fields">
        <div>
        <span className="muted small">Minutes</span>
        <Stepper
          label="minutes"
          value={cardio.minutes}
          step={CARDIO.minutesStep}
          min={1}
          max={CARDIO.minutesMax}
          onChange={(minutes) => props.onEdit((p, now) => setCardioDay(p, i, { ...cardio, minutes }, now))}
        />
        </div>
      </div>
    </div>
  );
}
