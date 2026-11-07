// Search, equipment and muscle filters and a paged list of exercises. The Library page uses it with links to each
// exercise; the plan editor's Add and Swap use it with a Choose button (owner request 2026-11-07: same filters there).
import { useEffect, useMemo, useState } from 'react';
import { getRepo } from '../training/data';
import { equipmentOf, lockedUntil } from '../../domain/profile';
import type { Exercise } from '../../domain/exercise';
import { BODY_SLUGS, SLUG_LABEL, type BodySlug } from '../../domain/muscle-map';
import { Button, Chip, ChipGroup, EmptyState } from '../../ui/primitives';
import { ExThumb } from './ExThumb';
import { filterLibrary, type KitChoice } from './filter';
import { kitLabel } from './labels';
import { readRanks } from '../progress/ranks-cache';

const KIT_OPTIONS: { value: KitChoice; label: string }[] = [
  { value: 'none', label: 'No equipment' },
  { value: 'dumbbell', label: 'Dumbbells' },
  { value: 'kettlebell', label: 'Kettlebell' },
  { value: 'bench', label: 'Bench' },
  { value: 'pullup_bar', label: 'Pull-up bar' },
  { value: 'band', label: 'Bands' },
];

const PAGE = 60;

export function LibraryBrowser(props: {
  exercises: readonly Exercise[];
  onPick?: (ex: Exercise) => void; // a Choose button per row; without it rows link to the exercise page
  note?: (ex: Exercise) => string | null;
  sticky?: boolean;
}) {
  const [text, setText] = useState('');
  const [kit, setKit] = useState<KitChoice[]>(['none', 'dumbbell']);
  const [muscle, setMuscle] = useState<BodySlug | null>(null);
  const [shown, setShown] = useState(PAGE);
  const [lock, setLock] = useState(false); // difficulty lock on: locked rows say which rank opens them
  // Default the equipment chips to what the user owns (UX design §3.3), once, when settings load.
  useEffect(() => {
    let alive = true;
    getRepo()
      .then((r) => r.getSettings())
      .then((s) => {
        if (!alive || !s) return;
        setKit(['none', ...equipmentOf(s)]);
        setLock(!!s.lockByRank);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);
  const ranks = useMemo(() => readRanks(), []);
  const rows = useMemo(() => filterLibrary(props.exercises, { text, kit, muscle }), [props.exercises, text, kit, muscle]);
  const reset = () => setShown(PAGE);

  return (
    <>
      <div className={props.sticky === false ? 'ui-stack' : 'ui-sticky'}>
        <input
          type="search"
          placeholder="Search exercises"
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            reset();
          }}
          aria-label="Search exercises"
        />
        <ChipGroup label="Equipment" options={KIT_OPTIONS} value={kit} onChange={(k) => (setKit(k), reset())} />
        <div className="ui-chips ui-scroll-x" role="group" aria-label="Muscle">
          {BODY_SLUGS.map((s) => (
            <Chip key={s} selected={muscle === s} onToggle={() => (setMuscle(muscle === s ? null : s), reset())}>
              {SLUG_LABEL[s]}
            </Chip>
          ))}
        </div>
        <span className="muted small">{rows.length} exercises</span>
      </div>

      {rows.length === 0 && <EmptyState title="No exercises match" body="Try fewer filters or another word." />}

      <ul className="ui-list ui-list--rows">
        {rows.slice(0, shown).map((ex) => {
          const locked = lock && ranks ? lockedUntil(ex, ranks) : null;
          const text = (
            <span className="ui-ex-text">
              <span>{ex.name}</span>
              <span className="muted small">
                {kitLabel(ex)} · {ex.muscles.primary.map((s) => SLUG_LABEL[s]).join(', ') || 'Muscles unknown'}
                {locked && <span className="lib-lock"> · Locked until rank {locked}</span>}
                {props.note?.(ex) && <span className="lib-lock"> · {props.note(ex)}</span>}
              </span>
            </span>
          );
          return (
            <li key={ex.id}>
              {props.onPick ? (
                <span className="ui-ex-row lib-pick">
                  <ExThumb ex={ex} locked={locked} />
                  {text}
                  <Button size="sm" variant="secondary" onClick={() => props.onPick!(ex)}>
                    Choose
                  </Button>
                </span>
              ) : (
                <a className="ui-list-link ui-ex-row" href={`#/library/${encodeURIComponent(ex.id)}`}>
                  <ExThumb ex={ex} locked={locked} />
                  {text}
                </a>
              )}
            </li>
          );
        })}
      </ul>
      {rows.length > shown && (
        <Button variant="secondary" block onClick={() => setShown(shown + PAGE)}>
          Show more
        </Button>
      )}
    </>
  );
}
