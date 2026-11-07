// Library (UX design §3, §6): search, equipment and muscle filters, pictures first. Equipment chips start at what the
// user owns (no equipment + dumbbells until settings load).
import { listExercises } from '../../data/exercises';
import { LibraryBrowser } from './LibraryBrowser';

export default function ExerciseList() {
  return (
    <section>
      <h1>Library</h1>
      <LibraryBrowser exercises={listExercises()} />
    </section>
  );
}
