// Progress v2 (UX design §6.6): body map in Ranks or Recovery mode, tap a muscle for its rank, XP to next, benchmark
// lift and exercises; bodyweight chart and weigh-in; streak and badges.
import { useEffect, useState } from 'react';
import { getExercise } from '../../data/exercises';
import type { BodySlug } from '../../domain/muscle-map';
import { RECOVERY, XP } from '../../config/thresholds';
import { badgeLabel } from '../xp/domain/badges';
import { GROUPS, BENCHMARK, type Group } from '../xp/domain/muscles';
import { GROUP_SLUGS, exercisesFor, groupOfSlug, recoveryOf, xpToNextRank, type Recovery } from '../xp/domain/hub';
import { ExerciseName } from '../library/ExerciseSheet';
import { BodyMap } from '../../ui/body/BodyMap';
import { SegmentedControl } from '../../ui/controls';
import { Card, RankBadge } from '../../ui/primitives';
import { loadProgress, type Loaded } from './load';
import { BodyweightCard } from './BodyweightCard';

const LABEL: Record<Group, string> = {
  chest: 'Chest',
  back: 'Back',
  shoulders: 'Shoulders',
  biceps: 'Biceps',
  triceps: 'Triceps',
  quads: 'Quads',
  hamstrings: 'Hamstrings',
  glutes: 'Glutes',
  calves: 'Calves',
  core: 'Core',
};

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
    const color = mode === 'ranks' ? `var(--rank-${state.muscles[g].rank})` : RECOVERY_COLOR[recovery[g]];
    for (const s of GROUP_SLUGS[g]) fills[s] = color;
  }

  const picked = state.muscles[selected];
  const next = xpToNextRank(picked.xp);
  const bench = BENCHMARK[selected];
  const trained = exercisesFor(selected, loaded.workouts, getExercise);

  return (
    <section className="ui-stack">
      <h1>Progress</h1>
      <p>
        {state.streak > 0 ? `${state.streak} ${state.streak === 1 ? 'week' : 'weeks'} in a row` : 'No streak yet'} · {state.sessions}{' '}
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
                <RankBadge rank={state.muscles[g].rank} />
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
        {loaded.bodyweight.length === 0 && <p className="muted small">Log your bodyweight below to allow rank-ups.</p>}
        {state.flaggedSets > 0 && (
          <p className="muted small">
            {state.flaggedSets} {state.flaggedSets === 1 ? 'set' : 'sets'} above {XP.overRepsCap} reps earned no XP.
          </p>
        )}
      </Card>

      <BodyweightCard entries={loaded.bodyweight} onChange={() => {
          const at = Date.now();
          return loadProgress(at).then((l) => setData({ now: at, loaded: l }));
        }} />

      <Card title="Badges">
        {state.badges.length === 0 ? (
          <p className="muted">No badges yet. The first session earns one.</p>
        ) : (
          <ul className="ui-list">
            {state.badges.map((b) => (
              <li key={b}>{badgeLabel(b)}</li>
            ))}
          </ul>
        )}
      </Card>
    </section>
  );
}
