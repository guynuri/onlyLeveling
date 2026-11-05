import { useMemo, useState } from 'react';
import { listExercises } from '../../data/exercises';
import { isDumbbellCompatible } from '../../domain/exercise';
import { EQUIPMENT_LABEL, PATTERN_LABEL } from './labels';

export default function ExerciseList() {
  const [dumbbellOnly, setDumbbellOnly] = useState(true);
  const rows = useMemo(() => {
    const all = listExercises();
    const filtered = dumbbellOnly ? all.filter(isDumbbellCompatible) : all;
    return [...filtered].sort((a, b) => a.name.localeCompare(b.name));
  }, [dumbbellOnly]);

  return (
    <section>
      <label className="toggle">
        <input type="checkbox" checked={dumbbellOnly} onChange={(e) => setDumbbellOnly(e.target.checked)} />
        Dumbbell and bodyweight only
      </label>
      <p className="muted">{rows.length} exercises</p>
      <ul className="exercise-list">
        {rows.map((ex) => (
          <li key={ex.id}>
            <a href={`#/library/${encodeURIComponent(ex.id)}`}>{ex.name}</a>
            <span className="muted">
              {EQUIPMENT_LABEL[ex.equipment]} · {PATTERN_LABEL[ex.movementPattern]}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
