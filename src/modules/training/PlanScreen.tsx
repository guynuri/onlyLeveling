import { useEffect, useState } from 'react';
import { listExercises, getExercise } from '../../data/exercises';
import { buildTemplate, type Template } from '../../domain/template';
import { TEMPLATE } from '../../config/thresholds';
import { getRepo, defaultSettings } from './data';

// The rules-based plan. Warm-up and cool-down are shown as their own blocks, never as exercises.
export default function PlanScreen() {
  const [template, setTemplate] = useState<Template | null>(null);

  useEffect(() => {
    getRepo()
      .then((r) => r.getSettings())
      .then((saved) => {
        const s = saved ?? defaultSettings();
        setTemplate(
          buildTemplate({
            daysPerWeek: s.daysPerWeek,
            exercisesPerDay: TEMPLATE.exercisesPerDay,
            avoid: [],
            catalogue: listExercises(),
          }),
        );
      });
  }, []);

  if (!template) return <p className="muted">Loading…</p>;

  return (
    <section>
      <h1>Plan</h1>
      <p className="muted">Rules-based plan from your settings. Dumbbell and bodyweight exercises only.</p>
      {template.days.map((day) => (
        <div key={day.index} className="plan-day">
          <h2>Day {day.index + 1}</h2>
          <h3>Warm-up</h3>
          <ul>
            {day.warmup.map((r) => (
              <li key={r.name}>
                {r.name} · {Math.round(r.seconds / 60)} min
              </li>
            ))}
          </ul>
          <h3>Exercises</h3>
          <ol>
            {day.exerciseIds.map((id) => (
              <li key={id}>{getExercise(id)?.name ?? id}</li>
            ))}
          </ol>
          <h3>Cool-down</h3>
          <ul>
            {day.cooldown.map((r) => (
              <li key={r.name}>
                {r.name} · {Math.round(r.seconds / 60)} min
              </li>
            ))}
          </ul>
        </div>
      ))}
    </section>
  );
}
