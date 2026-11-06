// Any screen opens the exercise sheet by id; the single ExerciseSheet in App listens (UX design §6.3).
export const OPEN_EXERCISE_EVENT = 'open-exercise';

export function openExercise(id: string): void {
  window.dispatchEvent(new CustomEvent(OPEN_EXERCISE_EVENT, { detail: id }));
}
