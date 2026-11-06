import { getExercise } from '../../data/exercises';
import ExerciseInfo from './ExerciseInfo';

// Library detail page. The same content opens as a sheet from Plan, Workout, History and coach cards.
export default function ExerciseDetail({ id }: { id: string }) {
  const ex = getExercise(id);
  return (
    <article className="subcomponent">
      <a href="#/library">← Library</a>
      <h1>{ex?.name ?? 'Exercise'}</h1>
      <ExerciseInfo id={id} />
    </article>
  );
}
