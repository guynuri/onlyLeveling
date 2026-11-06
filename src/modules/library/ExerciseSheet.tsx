// The exercise sheet (UX design §6.3), mounted once in App. It closes when the route changes, so a tapped link or
// the browser's Back never leaves the modal on top of another screen.
import { useEffect, useState } from 'react';
import { getExercise } from '../../data/exercises';
import { Sheet } from '../../ui/controls';
import ExerciseInfo from './ExerciseInfo';
import { OPEN_EXERCISE_EVENT, openExercise } from './open-exercise';

export default function ExerciseSheet() {
  const [id, setId] = useState<string | null>(null);

  useEffect(() => {
    const onOpen = (e: Event) => setId((e as CustomEvent<string>).detail);
    const onHash = () => setId(null);
    window.addEventListener(OPEN_EXERCISE_EVENT, onOpen);
    window.addEventListener('hashchange', onHash);
    return () => {
      window.removeEventListener(OPEN_EXERCISE_EVENT, onOpen);
      window.removeEventListener('hashchange', onHash);
    };
  }, []);

  const title = id ? (getExercise(id)?.name ?? 'Exercise') : 'Exercise';
  return (
    <Sheet open={id !== null} onClose={() => setId(null)} title={title}>
      {id && <ExerciseInfo id={id} />}
    </Sheet>
  );
}

// An exercise name that opens its sheet.
export function ExerciseName(props: { id: string; name: string }) {
  return (
    <button type="button" className="ui-exname" onClick={() => openExercise(props.id)}>
      {props.name}
    </button>
  );
}
