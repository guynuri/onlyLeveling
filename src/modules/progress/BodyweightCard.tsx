// Bodyweight (UX design §6.6): a chart of weigh-ins with the 7-day average line, and a form to log one.
import { useState } from 'react';
import type { BodyweightEntry } from '../../domain/types';
import { getRepo } from '../training/data';
import { isIsoDate } from '../training/validate';
import { weightTrend } from '../xp/domain/hub';
import { WEIGHT_TREND_DAYS } from '../../config/thresholds';
import { Button, Card } from '../../ui/primitives';

const SHOWN = 30; // last entries drawn

function Chart({ entries }: { entries: readonly BodyweightEntry[] }) {
  const t = weightTrend(entries).slice(-SHOWN);
  if (t.length < 2) return null;
  const kgs = t.flatMap((p) => [p.kg, p.avg]);
  const lo = Math.min(...kgs) - 0.5;
  const hi = Math.max(...kgs) + 0.5;
  const x = (i: number) => (i / (t.length - 1)) * 100;
  const y = (kg: number) => 40 - ((kg - lo) / (hi - lo)) * 40;
  const last = t[t.length - 1];
  return (
    <>
      <svg className="prog-chart" viewBox="-2 -2 104 44" preserveAspectRatio="none" role="img"
        aria-label={`Bodyweight from ${t[0].date} to ${last.date}: ${last.kg} kg, ${WEIGHT_TREND_DAYS}-day average ${last.avg.toFixed(1)} kg`}>
        {t.map((p, i) => (
          <ellipse key={p.date} className="raw" cx={x(i)} cy={y(p.kg)} rx="0.9" ry="1.4" />
        ))}
        <polyline className="avg" points={t.map((p, i) => `${x(i)},${y(p.avg)}`).join(' ')} />
      </svg>
      <p className="muted small">
        {lo.toFixed(1)}–{hi.toFixed(1)} kg · line: {WEIGHT_TREND_DAYS}-day average, now {last.avg.toFixed(1)} kg
      </p>
    </>
  );
}

export function BodyweightCard(props: { entries: BodyweightEntry[]; onChange: (e: BodyweightEntry[]) => void }) {
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [kg, setKg] = useState('');
  const [status, setStatus] = useState('');

  async function add() {
    const value = Number(kg);
    if (!isIsoDate(date)) return setStatus('Enter a date.');
    if (!(value > 0)) return setStatus('Enter a weight in kg.');
    try {
      const repo = await getRepo();
      await repo.addBodyweight(date, value);
      props.onChange(await repo.listBodyweight());
      setKg('');
      setStatus('Saved.');
    } catch {
      setStatus('Could not save. Try again.');
    }
  }

  const latest = [...props.entries].sort((a, b) => b.date.localeCompare(a.date))[0];
  return (
    <Card title="Bodyweight" action={latest && <span className="muted small">{latest.kg} kg on {latest.date}</span>}>
      <Chart entries={props.entries} />
      <div className="row">
        <label>
          Date
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
        <label>
          kg
          <input inputMode="decimal" value={kg} onChange={(e) => setKg(e.target.value)} />
        </label>
        <Button onClick={add}>Log</Button>
      </div>
      <p className="muted small" role="status">
        {status}
      </p>
    </Card>
  );
}
