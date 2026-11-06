// How an exercise is done: shared by the exercise sheet and the library detail page. U2 adds media, the body map,
// tips, your history and Swap here.
import { getExercise } from '../../data/exercises';
import { Card } from '../../ui/primitives';
import { EQUIPMENT_LABEL, LEVEL_LABEL, PATTERN_LABEL, mechanicLabel } from './labels';

export default function ExerciseInfo({ id }: { id: string }) {
  const ex = getExercise(id);
  if (!ex) return <p className="muted">Exercise not found.</p>;
  return (
    <div className="ui-stack">
      <div className="ui-chips" aria-label="About this exercise">
        <span className="ui-tag">{EQUIPMENT_LABEL[ex.equipment]}</span>
        <span className="ui-tag">{mechanicLabel(ex)}</span>
        <span className="ui-tag">{ex.level ? LEVEL_LABEL[ex.level] : 'Level unknown'}</span>
        <span className="ui-tag">{PATTERN_LABEL[ex.movementPattern]}</span>
      </div>
      <Card title="Muscles">
        <dl className="facts">
          <dt>Primary</dt>
          <dd>{ex.primaryMuscles.join(', ') || 'Unknown'}</dd>
          <dt>Secondary</dt>
          <dd>{ex.secondaryMuscles.join(', ') || 'None listed'}</dd>
        </dl>
      </Card>
      {ex.instructions.length > 0 && (
        <Card title="How to do it">
          <ol className="ui-steps">
            {ex.instructions.map((step, i) => (
              <li key={i}>{step}</li>
            ))}
          </ol>
        </Card>
      )}
      <footer className="source">
        Text from <a href={ex.sourceUrl ?? undefined}>free-exercise-db</a> · Licence: {ex.license}
        {ex.author ? ` · Author: ${ex.author}` : ' · Author: not stated'}
      </footer>
    </div>
  );
}
