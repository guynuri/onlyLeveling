// The top of the Plan screen (UX design §5): which week of the block you are in, the end-of-block offer, the deload
// toggle and the schedule. It never saves by itself: every change goes out through `onEdit`.
import { useState } from 'react';
import { blockOf, blockWeek, isDeloadWeek } from '../../domain/block';
import type { Plan } from '../../domain/plan';
import { extendBlock, setDeload, setSchedule } from '../../domain/plan-edit';
import { Button, Card, Chip, ProgressBar } from '../../ui/primitives';
import { SegmentedControl } from '../../ui/controls';

const EXTEND_WEEKS = 2;
// Monday first; the numbers are Date#getDay values (0 = Sunday).
const WEEKDAYS = [
  { value: 1, label: 'Mon' },
  { value: 2, label: 'Tue' },
  { value: 3, label: 'Wed' },
  { value: 4, label: 'Thu' },
  { value: 5, label: 'Fri' },
  { value: 6, label: 'Sat' },
  { value: 0, label: 'Sun' },
];

export function PlanHeader(props: {
  plan: Plan;
  now: number;
  onEdit: (edit: (now: number) => Plan) => void;
  onRegenerate: () => void;
}) {
  const { plan } = props;
  const week = blockWeek(plan, props.now);
  const block = blockOf(plan);
  const [mode, setMode] = useState<'rotation' | 'weekdays'>(plan.schedule ?? 'rotation');
  const [picked, setPicked] = useState<number[]>(plan.weekdays ?? []);
  const n = plan.days.length;

  const toggleDay = (d: number) => {
    const next = picked.includes(d) ? picked.filter((x) => x !== d) : [...picked, d];
    setPicked(next);
    // Saved only once there is one weekday per training day; until then the old schedule stays.
    if (next.length === n) props.onEdit((now) => setSchedule(plan, 'weekdays', [...next].sort((a, b) => a - b), now));
  };

  return (
    <div className="ui-stack">
      {week.over ? (
        <Card title="Block complete">
          <p className="muted">You finished all {week.of} weeks. Build the next block, or keep going with this one.</p>
          <div className="ui-row">
            <Button onClick={props.onRegenerate}>Build next block</Button>
            <Button variant="secondary" onClick={() => props.onEdit((now) => extendBlock(plan, EXTEND_WEEKS, now))}>
              Extend by {EXTEND_WEEKS} weeks
            </Button>
          </div>
        </Card>
      ) : (
        <Card title={`Week ${week.week} of ${week.of}`}>
          <ProgressBar value={week.week} max={week.of} label={`Week ${week.week} of ${week.of}`} />
          {isDeloadWeek(plan, props.now) && <p className="muted small">Deload week: lighter work so you come back fresh.</p>}
          <Chip selected={block.deloadLastWeek} onToggle={() => props.onEdit((now) => setDeload(plan, !block.deloadLastWeek, now))}>
            Deload in the last week
          </Chip>
        </Card>
      )}

      <Card title="Schedule">
        <SegmentedControl
          label="Schedule"
          options={[
            { value: 'rotation', label: 'Rotation' },
            { value: 'weekdays', label: 'Weekdays' },
          ]}
          value={mode}
          onChange={(v) => {
            setMode(v);
            if (v === 'rotation') props.onEdit((now) => setSchedule(plan, 'rotation', undefined, now));
          }}
        />
        {mode === 'rotation' ? (
          <p className="muted small">Each session is the next day in the plan, in order.</p>
        ) : (
          <>
            <p className="muted small">
              Pick {n} {n === 1 ? 'day' : 'days'}, one for each session in the plan ({picked.length} of {n}).
            </p>
            <div className="ui-chips" role="group" aria-label="Training weekdays">
              {WEEKDAYS.map((d) => (
                <Chip key={d.value} selected={picked.includes(d.value)} onToggle={() => toggleDay(d.value)}>
                  {d.label}
                </Chip>
              ))}
            </div>
          </>
        )}
      </Card>

      <div className="ui-row">
        <Button variant="ghost" onClick={props.onRegenerate}>
          New plan
        </Button>
      </div>
    </div>
  );
}
