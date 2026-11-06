import { useMemo, useState } from 'react';
import { listExercises } from '../../data/exercises';
import { isDumbbellCompatible } from '../../domain/exercise';
import { Chip } from '../../ui/primitives';
import { EQUIPMENT_LABEL, PATTERN_LABEL } from './labels';

// Library list. U2 adds pictures, muscle and owned-equipment filters.
export default function ExerciseList() {
  const [dumbbellOnly, setDumbbellOnly] = useState(true);
  const [query, setQuery] = useState('');
  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const all = listExercises();
    const filtered = (dumbbellOnly ? all.filter(isDumbbellCompatible) : all).filter((ex) => ex.name.toLowerCase().includes(q));
    return [...filtered].sort((a, b) => a.name.localeCompare(b.name));
  }, [dumbbellOnly, query]);

  return (
    <section>
      <h1>Library</h1>
      <div className="ui-sticky">
        <input type="search" placeholder="Search exercises" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search exercises" />
        <div className="ui-chips">
          <Chip selected={dumbbellOnly} onToggle={() => setDumbbellOnly(!dumbbellOnly)}>
            Dumbbell and bodyweight
          </Chip>
          <span className="muted small">{rows.length} exercises</span>
        </div>
      </div>
      <ul className="ui-list ui-list--rows">
        {rows.map((ex) => (
          <li key={ex.id}>
            <a className="ui-list-link" href={`#/library/${encodeURIComponent(ex.id)}`}>
              <span>{ex.name}</span>
              <span className="muted small">
                {EQUIPMENT_LABEL[ex.equipment]} · {PATTERN_LABEL[ex.movementPattern]}
              </span>
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
