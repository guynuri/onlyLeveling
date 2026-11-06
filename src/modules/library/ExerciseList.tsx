// Library (UX design §3, §6): search, equipment and muscle filters, pictures first. U3 defaults the equipment chips
// to what the user owns; until then they default to dumbbells + no equipment.
import { useMemo, useState } from 'react';
import { listExercises } from '../../data/exercises';
import { BODY_SLUGS, SLUG_LABEL, type BodySlug } from '../../domain/muscle-map';
import { Button, Chip, ChipGroup, EmptyState } from '../../ui/primitives';
import { BodyMap } from '../../ui/body/BodyMap';
import { filterLibrary, type KitChoice } from './filter';
import { kitLabel } from './labels';

const KIT_OPTIONS: readonly { value: KitChoice; label: string }[] = [
  { value: 'none', label: 'No equipment' },
  { value: 'dumbbell', label: 'Dumbbells' },
  { value: 'kettlebell', label: 'Kettlebell' },
  { value: 'bench', label: 'Bench' },
  { value: 'pullup_bar', label: 'Pull-up bar' },
  { value: 'band', label: 'Bands' },
];

const PAGE = 60;
const thumb = (path: string) => import.meta.env.BASE_URL + path;

export default function ExerciseList() {
  const [text, setText] = useState('');
  const [kit, setKit] = useState<KitChoice[]>(['none', 'dumbbell']);
  const [muscle, setMuscle] = useState<BodySlug | null>(null);
  const [shown, setShown] = useState(PAGE);
  const rows = useMemo(() => filterLibrary(listExercises(), { text, kit, muscle }), [text, kit, muscle]);

  return (
    <section>
      <h1>Library</h1>
      <div className="ui-sticky">
        <input
          type="search"
          placeholder="Search exercises"
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setShown(PAGE);
          }}
          aria-label="Search exercises"
        />
        <ChipGroup label="Equipment" options={KIT_OPTIONS} value={kit} onChange={(k) => (setKit(k), setShown(PAGE))} />
        <div className="ui-chips ui-scroll-x" role="group" aria-label="Muscle">
          {BODY_SLUGS.map((s) => (
            <Chip key={s} selected={muscle === s} onToggle={() => (setMuscle(muscle === s ? null : s), setShown(PAGE))}>
              {SLUG_LABEL[s]}
            </Chip>
          ))}
        </div>
        <span className="muted small">{rows.length} exercises</span>
      </div>

      {rows.length === 0 && <EmptyState title="No exercises match" body="Try fewer filters or another word." />}

      <ul className="ui-list ui-list--rows">
        {rows.slice(0, shown).map((ex) => (
          <li key={ex.id}>
            <a className="ui-list-link ui-ex-row" href={`#/library/${encodeURIComponent(ex.id)}`}>
              <span className="ui-ex-thumb">
                {ex.media ? (
                  <img src={thumb(ex.media.stills[ex.media.stills.length - 1])} alt="" loading="lazy" decoding="async" />
                ) : (
                  <BodyMap primary={ex.muscles.primary} size="sm" />
                )}
              </span>
              <span className="ui-ex-text">
                <span>{ex.name}</span>
                <span className="muted small">
                  {kitLabel(ex)} · {ex.muscles.primary.map((s) => SLUG_LABEL[s]).join(', ') || 'Muscles unknown'}
                </span>
              </span>
            </a>
          </li>
        ))}
      </ul>
      {rows.length > shown && (
        <Button variant="secondary" block onClick={() => setShown(shown + PAGE)}>
          Show more
        </Button>
      )}
    </section>
  );
}
