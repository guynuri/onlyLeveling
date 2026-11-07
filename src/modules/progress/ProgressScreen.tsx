// Progress v2 (UX design §6.6): body map in Ranks or Recovery mode, tap a muscle for its rank, XP to next, benchmark
// lift and exercises; bodyweight chart and weigh-in; streak and badges.
import { useEffect, useState } from 'react';
import { getExercise } from '../../data/exercises';
import type { BodySlug } from '../../domain/muscle-map';
import { RECOVERY, XP } from '../../config/thresholds';
import { BadgeGrid } from './BadgeGrid';
import { volumeRank } from '../xp/domain/rank';
import { GROUPS, GROUP_LABEL, BENCHMARK, type Group } from '../xp/domain/muscles';
import { GROUP_SLUGS, rankNote, rankProgress, exercisesFor, groupOfSlug, recoveryOf, xpToNextRank, type Recovery } from '../xp/domain/hub';
import { ExerciseName } from '../library/ExerciseSheet';
import { BodyMap } from '../../ui/body/BodyMap';
import { SegmentedControl } from '../../ui/controls';
import { Card, RankBadge } from '../../ui/primitives';
import { loadProgress, type Loaded } from './load';
import { BodyweightCard } from './BodyweightCard';
import { QuestsCard } from './GameCards';

const LABEL = GROUP_LABEL;

const RECOVERY_COLOR: Record<Recovery, string> = {
  recovering: 'var(--warn)',
  ready: 'var(--success)',
  neglected: 'var(--danger)',
};
const RECOVERY_LABEL: Record<Recovery, string> = {
  recovering: `Recovering (trained in the last ${RECOVERY.recoveringHours} h)`,
  ready: 'Ready',
  neglected: `Not trained for ${RECOVERY.neglectedDays}+ days`,
};

type Mode = 'ranks' | 'recovery';

// Volume progress toward the next rank, in that rank's colour.
function RankBar({ xp, big }: { xp: number; big?: boolean }) {
  const next = xpToNextRank(xp);
  const pct = Math.round(rankProgress(xp) * 100);
  return (
    <span className={big ? 'rank-bar rank-bar--big' : 'rank-bar'} role="progressbar" aria-label={next ? `${pct}% of the way to ${next.next}` : 'Top rank'} aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
      <span className="rank-bar-fill" style={{ width: `${pct}%`, background: `var(--rank-${next?.next ?? 'SSS'})` }} />
    </span>
  );
}

export default function ProgressScreen() {
  const [data, setData] = useState<{ loaded: Loaded; now: number } | null>(null);
  const [mode, setMode] = useState<Mode>('ranks');
  const [selected, setSelected] = useState<Group>('chest');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const now = Date.now();
    loadProgress(now)
      .then((loaded) => setData({ loaded, now }))
      .catch(() => setError('Could not load your progress. Reload to try again.'));
  }, []);

  if (error) return <p className="muted">{error}</p>;
  if (!data) return <p className="muted">Loading…</p>;

  const { loaded, now } = data;
  const { state } = loaded;
  const recovery = recoveryOf(loaded.workouts, getExercise, now);
  const fills: Partial<Record<BodySlug, string>> = {};
  for (const g of GROUPS) {
    const m = state.muscles[g];
    const vol = volumeRank(m.xp);
    // A rank held back by strength shows a blend toward its volume rank, so XP gains are visible on the map.
    const rankColor = vol === m.rank ? `var(--rank-${m.rank})` : `color-mix(in srgb, var(--rank-${m.rank}) 55%, var(--rank-${vol}))`;
    const color = mode === 'ranks' ? rankColor : RECOVERY_COLOR[recovery[g]];
    for (const s of GROUP_SLUGS[g]) fills[s] = color;
  }

  const picked = state.muscles[selected];
  const next = xpToNextRank(picked.xp);
  const bench = BENCHMARK[selected];
  const trained = exercisesFor(selected, loaded.workouts, getExercise);
  const note = rankNote(picked, loaded.bodyweight[0]?.kg ?? null); // listBodyweight is newest first

  return (
    <section className="ui-stack">
      <h1>Progress</h1>
      <p>
        {state.streak > 0 ? `${state.streak} ${state.streak === 1 ? 'week' : 'weeks'} in a row` : 'No streak yet'}
        {state.freezes > 0 && ` · ${state.freezes} streak ${state.freezes === 1 ? 'freeze' : 'freezes'} (a missed week uses one)`} · {state.sessions}{' '}
        {state.sessions === 1 ? 'session' : 'sessions'}
        {state.cardioSessions > 0 && ` · ${state.cardioSessions} cardio (${Math.round(state.cardioXp).toLocaleString()} XP)`}
      </p>

      <Card>
        <SegmentedControl
          label="Map mode"
          value={mode}
          onChange={setMode}
          options={[
            { value: 'ranks', label: 'Ranks' },
            { value: 'recovery', label: 'Recovery' },
          ]}
        />
        <BodyMap
          primary={[]}
          fills={fills}
          selected={new Set(GROUP_SLUGS[selected])}
          onPick={(s) => setSelected(groupOfSlug(s))}
          sex={loaded.settings.about?.sex}
          label={mode === 'ranks' ? 'Muscle ranks, tap a muscle' : 'Recovery by muscle, tap a muscle'}
        />
        {mode === 'recovery' && (
          <p className="prog-legend">
            {(['recovering', 'ready', 'neglected'] as const).map((r) => (
              <span key={r}>
                <span className="prog-dot" style={{ background: RECOVERY_COLOR[r] }} />
                {RECOVERY_LABEL[r]}
              </span>
            ))}
          </p>
        )}
        <div className="prog-muscles" role="group" aria-label="Muscles">
          {GROUPS.map((g) => (
            <button key={g} type="button" aria-pressed={g === selected} onClick={() => setSelected(g)}>
              <span>{LABEL[g]}</span>
              {mode === 'ranks' ? (
                <>
                  <RankBadge rank={state.muscles[g].rank} />
                  <RankBar xp={state.muscles[g].xp} />
                </>
              ) : (
                <span className="prog-dot" role="img" style={{ background: RECOVERY_COLOR[recovery[g]] }} aria-label={RECOVERY_LABEL[recovery[g]]} />
              )}
            </button>
          ))}
        </div>
      </Card>

      <Card title={LABEL[selected]} action={<RankBadge rank={picked.rank} />}>
        <p>
          {Math.round(picked.xp).toLocaleString()} XP
          {next ? ` · ${Math.round(next.need).toLocaleString()} XP to ${next.next}` : ' · top rank'}. Best so far: {picked.maxRank}.
        </p>
        <RankBar xp={picked.xp} big />
        {note && <p className="prog-note">{note}</p>}
        <p className="muted small">{RECOVERY_LABEL[recovery[selected]]}.</p>
        <p className="muted small">
          {bench ? (
            <>
              Benchmark lift: <ExerciseName id={bench} name={getExercise(bench)?.name ?? bench} /> against your bodyweight
              {picked.strength ? ` (strength rank ${picked.strength})` : ''}.
            </>
          ) : (
            'Ranked on volume only: no dumbbell benchmark lift for this muscle.'
          )}
        </p>
        {trained.length > 0 && (
          <ul className="ui-list">
            {trained.map((id) => (
              <li key={id}>
                <ExerciseName id={id} name={getExercise(id)?.name ?? id} />
              </li>
            ))}
          </ul>
        )}
        {state.flaggedSets > 0 && (
          <p className="muted small">
            {state.flaggedSets} {state.flaggedSets === 1 ? 'set' : 'sets'} above {XP.overRepsCap} reps earned no XP.
          </p>
        )}
      </Card>

      <QuestsCard quests={loaded.quests} />

      <BodyweightCard entries={loaded.bodyweight} onChange={() => {
          const at = Date.now();
          return loadProgress(at).then((l) => setData({ now: at, loaded: l }));
        }} />

      <BadgeGrid earned={state.badges} />
    </section>
  );
}
