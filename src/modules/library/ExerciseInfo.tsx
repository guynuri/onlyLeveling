// How an exercise is done (UX design §6.3): shared by the exercise sheet and the library detail page.
// Order: how it moves, which muscles, what it needs, how to do it, tips, your last sessions, swap, demo, source.
import { useEffect, useState } from 'react';
import { getExercise, listExercises } from '../../data/exercises';
import type { Exercise } from '../../domain/exercise';
import type { Plan } from '../../domain/plan';
import { replaceExercise, planExerciseIds } from '../../domain/plan';
import type { Workout } from '../../domain/types';
import { pickSwap } from '../coach/domain/swap';
import { getRepo, getLocalRepo, defaultSettings, currentPlan } from '../training/data';
import { Button, Card } from '../../ui/primitives';
import { toast } from '../../ui/controls';
import { ExerciseMedia } from '../../ui/ExerciseMedia';
import { BodyMap } from '../../ui/body/BodyMap';
import { LEVEL_LABEL, PLAN_CHANGED_EVENT, kitLabel, mechanicLabel } from './labels';
import { recentSessions, sourceLine, youtubeSearchUrl } from './exercise-facts';

// The saved plan and history, read once per opened exercise. Failures leave the sections out, never the sheet.
function useTrainingContext() {
  const [ctx, setCtx] = useState<{ plan: Plan; workouts: Workout[]; avoid: string[]; now: number } | null>(null);
  useEffect(() => {
    (async () => {
      const repo = await getRepo();
      const s = (await repo.getSettings()) ?? defaultSettings();
      const [plan, workouts] = await Promise.all([currentPlan(repo, await getLocalRepo(), s), repo.listWorkouts()]);
      setCtx({ plan, workouts, avoid: s.avoid ?? [], now: Date.now() });
    })().catch(() => setCtx(null));
  }, []);
  return [ctx, setCtx] as const;
}

function SwapButton({
  ex,
  plan,
  workouts,
  avoid,
  now,
  onSwapped,
}: {
  ex: Exercise;
  plan: Plan;
  workouts: Workout[];
  avoid: string[];
  now: number;
  onSwapped: (p: Plan) => void;
}) {
  const inPlan = new Set(planExerciseIds(plan));
  if (!inPlan.has(ex.id)) return null;
  const lastUsed = new Map<string, number>();
  for (const w of workouts) for (const e of w.entries) lastUsed.set(e.exerciseId, Math.max(lastUsed.get(e.exerciseId) ?? 0, w.start));
  const to = pickSwap({ exercise: ex, catalogue: listExercises(), inPlan, avoid: new Set(avoid), lastUsed, now });
  if (!to) return null;
  const swap = async () => {
    try {
      const next = replaceExercise(plan, ex.id, to.id, Date.now());
      await (await getRepo()).savePlan(next);
      onSwapped(next);
      window.dispatchEvent(new Event(PLAN_CHANGED_EVENT));
      toast(`Swapped for ${to.name} in your plan.`);
    } catch {
      toast('Could not swap that exercise. Try again.');
    }
  };
  return (
    <Button variant="secondary" onClick={swap}>
      Swap for {to.name}
    </Button>
  );
}

export default function ExerciseInfo({ id }: { id: string }) {
  const ex = getExercise(id);
  const [ctx, setCtx] = useTrainingContext();
  if (!ex) return <p className="muted">Exercise not found.</p>;
  const sessions = ctx ? recentSessions(ctx.workouts, id, 3) : [];

  return (
    <div className="ui-stack">
      <ExerciseMedia media={ex.media} name={ex.name} />
      <BodyMap primary={ex.muscles.primary} secondary={ex.muscles.secondary} />

      <div className="ui-chips" aria-label="About this exercise">
        <span className="ui-tag">{kitLabel(ex)}</span>
        <span className="ui-tag">{mechanicLabel(ex)}</span>
        <span className="ui-tag">{ex.level ? LEVEL_LABEL[ex.level] : 'Level unknown'}</span>
        {ex.unilateral && <span className="ui-tag">One side at a time</span>}
        {ex.mode === 'time' && <span className="ui-tag">Timed hold</span>}
      </div>

      {ex.description && <p>{ex.description}</p>}

      {ex.instructions.length > 0 && (
        <Card title="How to do it">
          <ol className="ui-steps">
            {ex.instructions.map((step, i) => (
              <li key={i}>{step}</li>
            ))}
          </ol>
        </Card>
      )}

      {ex.tips && ex.tips.length > 0 && (
        <Card title="Tips">
          <ul className="ui-steps">
            {ex.tips.map((t, i) => (
              <li key={i}>{t}</li>
            ))}
          </ul>
        </Card>
      )}

      {sessions.length > 0 && (
        <Card title="Your last sessions">
          <ul className="ui-list">
            {sessions.map((s) => (
              <li key={s.date}>
                <span>{new Date(s.date).toLocaleDateString()}</span>
                <span className="muted">
                  best {s.best.w} kg × {s.best.r}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <div className="ui-row">
        {ctx && <SwapButton ex={ex} plan={ctx.plan} workouts={ctx.workouts} avoid={ctx.avoid} now={ctx.now} onSwapped={(plan) => setCtx({ ...ctx, plan })} />}
        <a className="ui-btn ui-btn--ghost ui-btn--md" href={youtubeSearchUrl(ex.name)} target="_blank" rel="noopener noreferrer">
          Watch a demo
        </a>
      </div>

      <footer className="source">
        {sourceLine(ex)}
        {ex.sourceUrl && (
          <>
            {' · '}
            <a href={ex.sourceUrl} target="_blank" rel="noopener noreferrer">
              source
            </a>
          </>
        )}
      </footer>
    </div>
  );
}
