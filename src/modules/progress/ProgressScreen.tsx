// Progress (SPEC §4b, PLAN Phase 6): muscle bars and ranks, the body figure, the weekly streak and badges.
// Everything is computed from history here; only badges are stored (awarded once, never revoked).
import { useEffect, useState } from 'react';
import { getExercise } from '../../data/exercises';
import { getRepo, defaultSettings, repRangeFor } from '../training/data';
import { computeProgress, type ProgressState } from '../xp/domain/progress';
import { GROUPS, BENCHMARK, type Group } from '../xp/domain/muscles';
import { XP } from '../../config/thresholds';
import { badgeLabel } from '../xp/domain/badges';
import { BodyFigure } from './BodyFigure';

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

// The XP that fills a muscle bar: the B threshold. B is a guide, so a bar that passes it keeps going.
const FULL = XP.rankXp.B;

export default function ProgressScreen() {
  const [state, setState] = useState<ProgressState | null>(null);
  const [hasBodyweight, setHasBodyweight] = useState(false);
  const [selected, setSelected] = useState<Group>('chest');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const repo = await getRepo();
      const s = (await repo.getSettings()) ?? defaultSettings();
      const workouts = await repo.listWorkouts();
      const bodyweight = await repo.listBodyweight();
      const now = Date.now();
      const p = computeProgress({
        workouts,
        exerciseById: getExercise,
        bodyweight,
        daysPerWeek: s.daysPerWeek,
        repMaxFor: (id) => {
          const ex = getExercise(id);
          return ex ? repRangeFor(ex).max : 0;
        },
        now,
      });
      // Record badges the first time they show. Earned badges stay listed even if history is later edited.
      for (const key of p.badges) await repo.awardBadge(key, now);
      const stored = (await repo.listBadges()).map((b) => b.badgeKey);
      setHasBodyweight(bodyweight.length > 0);
      setState({ ...p, badges: [...new Set([...stored, ...p.badges])] });
    })().catch(() => setError('Could not load your progress. Reload to try again.'));
  }, []);

  if (error) return <p className="muted">{error}</p>;
  if (!state) return <p className="muted">Loading…</p>;

  const picked = state.muscles[selected];
  const benchmark = BENCHMARK[selected];

  return (
    <section>
      <h1>Progress</h1>
      <p>
        {state.streak > 0 ? `${state.streak} ${state.streak === 1 ? 'week' : 'weeks'} in a row` : 'No streak yet'} ·{' '}
        {state.sessions} {state.sessions === 1 ? 'session' : 'sessions'}
      </p>
      {state.flaggedSets > 0 && (
        <p className="muted small">
          {state.flaggedSets} {state.flaggedSets === 1 ? 'set' : 'sets'} above {XP.overRepsCap} reps earned no XP.
        </p>
      )}

      <div className="progress-top">
        <BodyFigure
          xpFor={(g) => state.muscles[g].xp}
          rankFor={(g) => state.muscles[g].rank}
          fullXp={FULL}
          selected={selected}
          onPick={setSelected}
        />
        <ul className="muscle-list">
          {GROUPS.map((g) => {
            const m = state.muscles[g];
            const pct = Math.min(100, Math.round((m.xp / FULL) * 100));
            return (
              <li key={g}>
                <button type="button" aria-pressed={g === selected} onClick={() => setSelected(g)}>
                  <span>{LABEL[g]}</span> <span className="muted">{m.rank}</span>
                </button>
                <div className="bar" aria-hidden="true">
                  <div className="bar-fill" style={{ width: `${pct}%` }} />
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      <article className="progress-detail">
        <h2>
          {LABEL[selected]} · rank {picked.rank}
        </h2>
        <p>
          {Math.round(picked.xp).toLocaleString()} XP. Best rank so far: {picked.maxRank}.
        </p>
        <p className="muted small">
          {benchmark
            ? 'Strength is measured with one dumbbell lift against your bodyweight.'
            : 'Ranked on volume only: the library has no dumbbell lift for this muscle.'}
        </p>
        {!hasBodyweight && <p className="muted small">Log your bodyweight to allow rank-ups.</p>}
      </article>

      <h2>Badges</h2>
      {state.badges.length === 0 ? (
        <p className="muted">No badges yet. The first session earns one.</p>
      ) : (
        <ul>
          {state.badges.map((b) => (
            <li key={b}>{badgeLabel(b)}</li>
          ))}
        </ul>
      )}
    </section>
  );
}
