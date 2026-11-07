// A warm-up or cool-down: library stretches and pulse raisers open their exercise sheet; older generic items are text.
import type { RoutineItem } from '../../domain/template';
import { ExerciseName } from '../library/ExerciseSheet';

export const duration = (s: number) => (s < 90 ? `${s} s` : `${Math.round(s / 60)} min`);

export function RoutineList({ items, part }: { items: readonly RoutineItem[]; part?: string }) {
  return (
    <ul className="ui-list">
      {items.map((r) => (
        <li key={(part ?? '') + (r.exerciseId ?? r.name)}>
          <span>
            {part && <span className="muted small">{part} · </span>}
            {r.exerciseId ? <ExerciseName id={r.exerciseId} name={r.name} /> : r.name}
          </span>
          <span className="muted small">{duration(r.seconds)}</span>
        </li>
      ))}
    </ul>
  );
}
