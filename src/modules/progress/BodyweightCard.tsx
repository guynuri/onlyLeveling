// Bodyweight (UX design §6.6): the latest weight and its 7-day average up top, a chart of weigh-ins with the average
// line, and a one-tap weigh-in (stepper pre-filled with the last weight; another day only when asked).
import { useState } from 'react';
import type { BodyweightEntry } from '../../domain/types';
import { getRepo } from '../training/data';
import { isIsoDate } from '../training/validate';
import { weightTrend } from '../xp/domain/hub';
import { WEIGHT_TREND_DAYS } from '../../config/thresholds';
import { Button, Card } from '../../ui/primitives';
import { Stepper } from '../../ui/controls';

const SHOWN = 30; // last entries drawn
const FIRST_GUESS_KG = 70; // stepper start before any weigh-in

function Chart({ trend }: { trend: ReturnType<typeof weightTrend> }) {
  const t = trend.slice(-SHOWN);
  if (t.length < 2) return null;
  const kgs = t.flatMap((p) => [p.kg, p.avg]);
  const lo = Math.min(...kgs) - 0.5;
  const hi = Math.max(...kgs) + 0.5;
  const x = (i: number) => (i / (t.length - 1)) * 100;
  const y = (kg: number) => 40 - ((kg - lo) / (hi - lo)) * 40;
  const line = t.map((p, i) => `${x(i)},${y(p.avg)}`).join(' ');
  return (
    <svg className="bw-chart" viewBox="-2 -2 104 44" preserveAspectRatio="none" role="img" aria-label={`Bodyweight from ${t[0].date} to ${t[t.length - 1].date}`}>
      <defs>
        <linearGradient id="bw-fill" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="var(--accent)" stopOpacity="0.35" />
          <stop offset="1" stopColor="var(--accent)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon className="bw-area" points={`0,42 ${line} 100,42`} fill="url(#bw-fill)" />
      {t.map((p, i) => (
        <ellipse key={p.date} className="bw-dot" cx={x(i)} cy={y(p.kg)} rx="0.9" ry="1.4" />
      ))}
      <polyline className="bw-line" points={line} />
    </svg>
  );
}

// Local calendar date: toISOString is UTC and gives yesterday just after midnight east of Greenwich.
function todayLocal(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function isoMinusDays(iso: string, n: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d - n));
  return t.toISOString().slice(0, 10); // UTC on a UTC date: no timezone shift
}

export function BodyweightCard(props: { entries: BodyweightEntry[]; onChange: () => Promise<void> }) {
  const trend = weightTrend(props.entries);
  const last = trend[trend.length - 1];
  // The average a week before the latest weigh-in: the last entry on or before that day.
  const weekAgo = last ? trend.filter((p) => p.date <= isoMinusDays(last.date, 7)).pop() : undefined;
  const [kg, setKg] = useState(last?.kg ?? FIRST_GUESS_KG);
  const [date, setDate] = useState(todayLocal);
  const [otherDay, setOtherDay] = useState(false);
  const [status, setStatus] = useState('');

  async function add() {
    const day = otherDay ? date : todayLocal();
    if (!isIsoDate(day)) return setStatus('Pick a date.');
    try {
      await (await getRepo()).addBodyweight(day, kg);
    } catch {
      return setStatus('Could not save. Try again.');
    }
    setStatus(`Logged ${kg} kg.`);
    setOtherDay(false);
    await props.onChange().catch(() => setStatus('Saved. Reload to see it in the chart.'));
  }

  const delta = last && weekAgo ? last.avg - weekAgo.avg : null;
  return (
    <Card title="Bodyweight">
      {last ? (
        <div className="bw-head">
          <span className="bw-now">
            {last.kg}
            <span className="bw-unit"> kg</span>
          </span>
          <span className="bw-meta">
            <span>{WEIGHT_TREND_DAYS}-day avg {last.avg.toFixed(1)} kg</span>
            {delta !== null && (
              <span className={delta > 0 ? 'bw-up' : delta < 0 ? 'bw-down' : ''}>
                {delta > 0 ? '▲' : delta < 0 ? '▼' : '•'} {Math.abs(delta).toFixed(1)} kg
              </span>
            )}
          </span>
        </div>
      ) : (
        <p className="muted small">Weigh in to track your trend and unlock muscle ranks.</p>
      )}
      <Chart trend={trend} />
      <div className="bw-log">
        <Stepper label="Weight" unit="kg" value={kg} step={0.1} min={20} max={300} onChange={(v) => setKg(Math.round(v * 10) / 10)} />
        <Button onClick={add}>{otherDay ? 'Log' : 'Log today'}</Button>
      </div>
      {otherDay ? (
        <label className="bw-date">
          Date
          <input type="date" value={date} max={todayLocal()} onChange={(e) => setDate(e.target.value)} />
        </label>
      ) : (
        <Button variant="ghost" size="sm" onClick={() => setOtherDay(true)}>
          Another day?
        </Button>
      )}
      <p className="muted small" role="status">
        {status}
      </p>
    </Card>
  );
}
