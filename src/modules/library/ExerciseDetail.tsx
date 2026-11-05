import { getExercise } from '../../data/exercises';
import { EQUIPMENT_LABEL, LEVEL_LABEL, PATTERN_LABEL, mechanicLabel } from './labels';

export default function ExerciseDetail({ id }: { id: string }) {
  const ex = getExercise(id);
  if (!ex) {
    return (
      <section>
        <p>Exercise not found.</p>
        <a href="#/library">Back to the library</a>
      </section>
    );
  }
  return (
    <article>
      <a href="#/library">← Library</a>
      <h1>{ex.name}</h1>
      <dl className="facts">
        <dt>Equipment</dt>
        <dd>{EQUIPMENT_LABEL[ex.equipment]}</dd>
        <dt>Movement</dt>
        <dd>{PATTERN_LABEL[ex.movementPattern]}</dd>
        <dt>Mechanic</dt>
        <dd>{mechanicLabel(ex)}</dd>
        <dt>Level</dt>
        <dd>{ex.level ? LEVEL_LABEL[ex.level] : 'Unknown'}</dd>
        <dt>Primary muscles</dt>
        <dd>{ex.primaryMuscles.join(', ') || 'Unknown'}</dd>
        <dt>Secondary muscles</dt>
        <dd>{ex.secondaryMuscles.join(', ') || 'None listed'}</dd>
      </dl>
      {ex.instructions.length > 0 && (
        <>
          <h2>Instructions</h2>
          <ol>
            {ex.instructions.map((step, i) => (
              <li key={i}>{step}</li>
            ))}
          </ol>
        </>
      )}
      <footer className="source">
        Text from <a href={ex.sourceUrl ?? undefined}>free-exercise-db</a> · Licence: {ex.license}
        {ex.author ? ` · Author: ${ex.author}` : ' · Author: not stated'}
      </footer>
    </article>
  );
}
