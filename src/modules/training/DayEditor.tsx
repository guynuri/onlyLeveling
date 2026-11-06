// Edit one day of the plan in place (UX design §5; owner: anyone can change a template or an AI plan however they
// want). Add any library exercise, remove, reorder, change sets and rep range, swap. Every change goes out through
// `onEdit` as a pure plan edit; the screen saves it.
import { useState } from 'react';
import { getExercise, listExercises } from '../../data/exercises';
import { movementPattern, usableWith, type Exercise } from '../../domain/exercise';
import { addExercise, moveExercise, removeExercise, replaceInDay, setTarget } from '../../domain/plan-edit';
import type { Plan } from '../../domain/plan';
import { repRangeFor } from '../../domain/reps';
import type { Target, TemplateDay } from '../../domain/template';
import type { EquipmentChoice } from '../../domain/types';
import { targetOf } from '../../domain/block';
import { filterLibrary } from '../library/filter';
import { ExerciseName } from '../library/ExerciseSheet';
import { Button } from '../../ui/primitives';
import { Sheet, Stepper } from '../../ui/controls';

const SHOWN = 40; // the library has hundreds of exercises; search narrows the list

type Picker = { mode: 'add' } | { mode: 'swap'; fromId: string } | null;

function ExercisePicker(props: {
  open: boolean;
  title: string;
  exercises: readonly Exercise[];
  note: (ex: Exercise) => string | null;
  onPick: (ex: Exercise) => void;
  onClose: () => void;
}) {
  const [text, setText] = useState('');
  const rows = filterLibrary(props.exercises, { text, kit: [], muscle: null }).slice(0, SHOWN);
  return (
    <Sheet open={props.open} onClose={props.onClose} title={props.title}>
      <input
        type="search"
        placeholder="Search exercises"
        aria-label="Search exercises"
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <ul className="ui-list">
        {rows.map((ex) => (
          <li key={ex.id}>
            <span>
              {ex.name}
              {props.note(ex) && <span className="muted small"> · {props.note(ex)}</span>}
            </span>
            <Button size="sm" variant="secondary" onClick={() => props.onPick(ex)}>
              Choose
            </Button>
          </li>
        ))}
        {rows.length === 0 && <li className="muted small">Nothing matches.</li>}
      </ul>
      {rows.length === SHOWN && <p className="muted small">Showing the first {SHOWN}. Search to narrow it down.</p>}
    </Sheet>
  );
}

export function DayEditor(props: {
  plan: Plan;
  day: TemplateDay;
  equipment: readonly EquipmentChoice[];
  blocked: readonly string[];
  onEdit: (edit: (now: number) => Plan) => void;
}) {
  const { plan, day } = props;
  const [picker, setPicker] = useState<Picker>(null);
  const di = plan.days.indexOf(day);
  const blocked = new Set(props.blocked);
  const inDay = new Set(day.exerciseIds);

  const retarget = (id: string, t: Target) => props.onEdit((now) => setTarget(plan, di, id, t, now));

  // Any library exercise can be added by hand; the note says when it needs kit the user has not picked.
  const addable = listExercises().filter((e) => !inDay.has(e.id));
  const swappable = listExercises().filter((e) => usableWith(e, props.equipment) && movementPattern(e) !== 'unknown' && !inDay.has(e.id) && !blocked.has(e.id));
  const addNote = (e: Exercise) => (usableWith(e, props.equipment) ? null : 'needs equipment you have not picked');

  return (
    <>
      <ol className="ui-list ui-list--numbered">
        {day.exerciseIds.map((id, i) => {
          const ex = getExercise(id);
          const t = ex ? targetOf(day, ex) : (day.targets?.[id] ?? { sets: 3, repMin: 8, repMax: 12 });
          return (
            <li key={id} className="ui-list-stack">
              <ExerciseName id={id} name={ex?.name ?? id} />
              <div className="ui-row">
                <div>
                  <span className="muted small">Sets</span>
                  <Stepper label="sets" value={t.sets} min={1} max={5} onChange={(v) => retarget(id, { ...t, sets: v })} />
                </div>
                <div>
                  <span className="muted small">Min reps</span>
                  <Stepper
                    label="min reps"
                    value={t.repMin}
                    min={1}
                    max={50}
                    onChange={(v) => retarget(id, { ...t, repMin: v, repMax: Math.max(v, t.repMax) })}
                  />
                </div>
                <div>
                  <span className="muted small">Max reps</span>
                  <Stepper
                    label="max reps"
                    value={t.repMax}
                    min={1}
                    max={50}
                    onChange={(v) => retarget(id, { ...t, repMax: v, repMin: Math.min(v, t.repMin) })}
                  />
                </div>
              </div>
              <div className="ui-row">
                <Button size="sm" variant="ghost" disabled={i === 0} aria-label={`Move ${ex?.name ?? id} up`} onClick={() => props.onEdit((now) => moveExercise(plan, di, id, -1, now))}>
                  Up
                </Button>
                <Button size="sm" variant="ghost" disabled={i === day.exerciseIds.length - 1} aria-label={`Move ${ex?.name ?? id} down`} onClick={() => props.onEdit((now) => moveExercise(plan, di, id, 1, now))}>
                  Down
                </Button>
                <Button size="sm" variant="secondary" onClick={() => setPicker({ mode: 'swap', fromId: id })}>
                  Swap
                </Button>
                <Button
                  size="sm"
                  variant="danger"
                  disabled={day.exerciseIds.length <= 1}
                  aria-label={`Remove ${ex?.name ?? id}`}
                  onClick={() => props.onEdit((now) => removeExercise(plan, di, id, now))}
                >
                  Remove
                </Button>
              </div>
            </li>
          );
        })}
      </ol>
      {day.exerciseIds.length <= 1 && <p className="muted small">A day needs at least one exercise.</p>}
      <Button variant="secondary" onClick={() => setPicker({ mode: 'add' })}>
        Add exercise
      </Button>

      <ExercisePicker
        open={picker?.mode === 'add'}
        title="Add an exercise"
        exercises={addable}
        note={addNote}
        onClose={() => setPicker(null)}
        onPick={(ex) => {
          const r = repRangeFor(ex);
          props.onEdit((now) => addExercise(plan, di, ex.id, { sets: 3, repMin: r.min, repMax: r.max }, now));
          setPicker(null);
        }}
      />
      <ExercisePicker
        open={picker?.mode === 'swap'}
        title="Swap for"
        exercises={swappable}
        note={() => null}
        onClose={() => setPicker(null)}
        onPick={(ex) => {
          if (picker?.mode === 'swap') props.onEdit((now) => replaceInDay(plan, di, picker.fromId, ex.id, now));
          setPicker(null);
        }}
      />
    </>
  );
}
