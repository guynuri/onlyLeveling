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
  onEdit: (edit: (plan: Plan, now: number) => Plan) => void;
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
    if (next.length === n) props.onEdit((p, now) => setSchedule(p, 'weekdays', [...next].sort((a, b) => a - b), now));
  };

  const summary = `${mode === 'rotation' ? 'Rotation' : `Weekdays (${picked.length} of ${n})`} · ${block.deloadLastWeek ? 'deload in the last week' : 'no deload week'}`;
  return (
    <Card
      className="ph-card"
      title={week.over ? 'Block complete' : `Week ${week.week} of ${week.of}`}
      action={
        <Button size="sm" variant="ghost" onClick={props.onRegenerate}>
          New plan
        </Button>
      }
    >
      {week.over ? (
        <>
          <p className="muted small">You finished all {week.of} weeks. Build the next block, or keep going with this one.</p>
          <div className="ui-row">
            <Button size="sm" onClick={props.onRegenerate}>
              Build next block
            </Button>
            <Button size="sm" variant="secondary" onClick={() => props.onEdit((p, now) => extendBlock(p, EXTEND_WEEKS, now))}>
              Extend by {EXTEND_WEEKS} weeks
            </Button>
          </div>
        </>
      ) : (
        <>
          <ProgressBar value={week.week} max={week.of} label={`Week ${week.week} of ${week.of}`} />
          {isDeloadWeek(plan, props.now) && <p className="muted small">Deload week: lighter work so you come back fresh.</p>}
        </>
      )}
      <details className="ph-settings">
        <summary className="muted small">{summary}</summary>
        <SegmentedControl
          label="Schedule"
          options={[
            { value: 'rotation', label: 'Rotation' },
            { value: 'weekdays', label: 'Weekdays' },
          ]}
          value={mode}
          onChange={(v) => {
            setMode(v);
            if (v === 'rotation') props.onEdit((p, now) => setSchedule(p, 'rotation', undefined, now));
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
        <Chip selected={block.deloadLastWeek} onToggle={() => props.onEdit((p, now) => setDeload(p, !block.deloadLastWeek, now))}>
          Deload in the last week
        </Chip>
      </details>
    </Card>
  );
}
