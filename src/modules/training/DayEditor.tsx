// Edit one day of the plan in place (UX design §5; owner: anyone can change a template or an AI plan however they
// want). Compact rows (picture, name, sets × reps); tapping a row's chevron opens its editor: sets, rep range, move,
// swap, remove. Swap suggests similar exercises first (coach swap rules); the whole library is one tap further.
// Every change goes out through `onEdit` as a pure plan edit; the screen saves it.
import { useState } from 'react';
import { ArrowDown, ArrowUp, ChevronDown, Link2, Repeat, Trash2, Unlink2 } from 'lucide-react';
import { groupOf, linkNext, supersetLabel, unlink } from '../../domain/superset';
import { getExercise, listExercises } from '../../data/exercises';
import { usableWith, type Exercise } from '../../domain/exercise';
import { addExercise, moveExercise, removeExercise, replaceInDay, setSupersets, setTarget } from '../../domain/plan-edit';
import type { Plan } from '../../domain/plan';
import { repRangeFor } from '../../domain/reps';
import type { Target, TemplateDay } from '../../domain/template';
import type { EquipmentChoice } from '../../domain/types';
import { targetOf } from '../../domain/block';
import { SLUG_LABEL } from '../../domain/muscle-map';
import { swapCandidates } from '../coach/domain/swap';
import { filterLibrary } from '../library/filter';
import { ExerciseName } from '../library/ExerciseSheet';
import { ExThumb } from '../library/ExThumb';
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
            <span className="pe-head">
              <ExThumb ex={ex} className="pe-thumb" />
              <span className="pe-text">
                <span>{ex.name}</span>
                {props.note(ex) && <span className="muted small">{props.note(ex)}</span>}
              </span>
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
  onEdit: (edit: (plan: Plan, now: number) => Plan) => void;
}) {
  const { plan, day } = props;
  const [picker, setPicker] = useState<Picker>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [browse, setBrowse] = useState(false); // swap: the whole library instead of the suggestions
  const di = plan.days.indexOf(day);
  const blocked = new Set(props.blocked);
  const inDay = new Set(day.exerciseIds);
  const inPlan = new Set(plan.days.flatMap((d) => d.exerciseIds));

  const retarget = (id: string, t: Target) => props.onEdit((p, now) => setTarget(p, di, id, t, now));
  const close = () => {
    setPicker(null);
    setBrowse(false);
  };

  // Any library exercise can be added by hand; the note says when it needs kit the user has not picked.
  const addable = listExercises().filter((e) => !inDay.has(e.id));
  const swappable = listExercises().filter((e) => usableWith(e, props.equipment) && !inDay.has(e.id) && !blocked.has(e.id));
  const addNote = (e: Exercise) => (usableWith(e, props.equipment) ? null : 'Needs equipment you have not picked');
  const swapFrom = picker?.mode === 'swap' ? getExercise(picker.fromId) : undefined;
  // Recency is not known here (no history on this screen), so suggestions rank by pattern and mechanic only.
  const similar = swapFrom
    ? swapCandidates({ exercise: swapFrom, catalogue: listExercises(), inPlan, avoid: blocked, equipment: props.equipment, lastUsed: new Map(), now: 0 })
    : [];
  const swapTo = (toId: string) => {
    if (picker?.mode === 'swap') {
      const fromId = picker.fromId;
      props.onEdit((p, now) => replaceInDay(p, di, fromId, toId, now));
    }
    setOpenId(null);
    close();
  };

  return (
    <>
      <ol className="pe-list">
        {day.exerciseIds.map((id, i) => {
          const ex = getExercise(id);
          const t = ex ? targetOf(day, ex) : (day.targets?.[id] ?? { sets: 3, repMin: 8, repMax: 12 });
          const open = openId === id;
          const reps = t.repMin === t.repMax ? `${t.repMin}` : `${t.repMin}–${t.repMax}`;
          const name = ex?.name ?? id;
          const ss = supersetLabel(day, id);
          const grouped = groupOf(day, id);
          const canLink = i < day.exerciseIds.length - 1 && linkNext(day, id).some((g) => g.includes(id) && g.length > (grouped?.length ?? 1));
          return (
            <li key={id} className={`pe-row${open ? ' pe-row--open' : ''}${ss ? ' pe-row--ss' : ''}`}>
              <div className="pe-head">
                {ex && <ExThumb ex={ex} className="pe-thumb" />}
                <span className="pe-text">
                  <ExerciseName id={id} name={name} />
                  <span className="muted small">
                    {ss && <span className="pe-ss">Superset {ss}</span>}
                    {t.sets} × {reps}
                    {ex?.mode === 'time' ? ' s' : ''}
                  </span>
                </span>
                <button type="button" className="pe-toggle" aria-expanded={open} aria-label={`Edit ${name}`} onClick={() => setOpenId(open ? null : id)}>
                  <ChevronDown />
                </button>
              </div>
              {open && (
                <div className="pe-edit">
                  <div className="pe-fields">
                    <div className="pe-field">
                      <span className="muted small">Sets</span>
                      <Stepper label="sets" value={t.sets} min={1} max={5} onChange={(v) => retarget(id, { ...t, sets: v })} />
                    </div>
                    <div className="pe-field">
                      <span className="muted small">Reps from</span>
                      <Stepper label="min reps" value={t.repMin} min={1} max={50} onChange={(v) => retarget(id, { ...t, repMin: v, repMax: Math.max(v, t.repMax) })} />
                    </div>
                    <div className="pe-field">
                      <span className="muted small">to</span>
                      <Stepper label="max reps" value={t.repMax} min={1} max={50} onChange={(v) => retarget(id, { ...t, repMax: v, repMin: Math.min(v, t.repMin) })} />
                    </div>
                  </div>
                  <div className="pe-actions">
                    <Button size="sm" variant="ghost" icon={<ArrowUp />} disabled={i === 0} aria-label={`Move ${name} up`} onClick={() => props.onEdit((p, now) => moveExercise(p, di, id, -1, now))}>
                      Up
                    </Button>
                    <Button size="sm" variant="ghost" icon={<ArrowDown />} disabled={i === day.exerciseIds.length - 1} aria-label={`Move ${name} down`} onClick={() => props.onEdit((p, now) => moveExercise(p, di, id, 1, now))}>
                      Down
                    </Button>
                    {grouped ? (
                      <Button size="sm" variant="ghost" icon={<Unlink2 />} onClick={() => props.onEdit((p, now) => setSupersets(p, di, unlink(day, id), now))}>
                        Unlink
                      </Button>
                    ) : null}
                    {canLink && (
                      <Button size="sm" variant="ghost" icon={<Link2 />} onClick={() => props.onEdit((p, now) => setSupersets(p, di, linkNext(day, id), now))}>
                        Superset with next
                      </Button>
                    )}
                    <Button size="sm" variant="secondary" icon={<Repeat />} onClick={() => setPicker({ mode: 'swap', fromId: id })}>
                      Swap
                    </Button>
                    <Button
                      size="sm"
                      variant="danger"
                      icon={<Trash2 />}
                      disabled={day.exerciseIds.length <= 1}
                      aria-label={`Remove ${name}`}
                      onClick={() => props.onEdit((p, now) => removeExercise(p, di, id, now))}
                    >
                      Remove
                    </Button>
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ol>
      {day.exerciseIds.length <= 1 && <p className="muted small">A day needs at least one exercise.</p>}
      <Button variant="ghost" size="sm" onClick={() => setPicker({ mode: 'add' })}>
        + Add exercise
      </Button>

      <ExercisePicker
        open={picker?.mode === 'add'}
        title="Add an exercise"
        exercises={addable}
        note={addNote}
        onClose={close}
        onPick={(ex) => {
          const r = repRangeFor(ex);
          props.onEdit((p, now) => addExercise(p, di, ex.id, { sets: 3, repMin: r.min, repMax: r.max }, now));
          close();
        }}
      />
      <ExercisePicker open={picker?.mode === 'swap' && browse} title="Swap for" exercises={swappable} note={() => null} onClose={close} onPick={(ex) => swapTo(ex.id)} />
      <Sheet open={picker?.mode === 'swap' && !browse} onClose={close} title={`Similar to ${swapFrom?.name ?? 'this'}`}>
        {similar.length === 0 ? (
          <p className="muted">No close match with your equipment.</p>
        ) : (
          <ul className="ui-list">
            {similar.map((c) => (
              <li key={c.id}>
                <span className="pe-head">
                  <ExThumb ex={c} className="pe-thumb" />
                  <span className="pe-text">
                    <span>{c.name}</span>
                    <span className="muted small">{c.muscles.primary.map((m) => SLUG_LABEL[m]).join(', ')}</span>
                  </span>
                </span>
                <Button size="sm" variant="secondary" onClick={() => swapTo(c.id)}>
                  Choose
                </Button>
              </li>
            ))}
          </ul>
        )}
        <Button variant="ghost" block onClick={() => setBrowse(true)}>
          Search the whole library
        </Button>
      </Sheet>
    </>
  );
}
