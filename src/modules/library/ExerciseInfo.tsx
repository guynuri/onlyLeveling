// How an exercise is done (UX design §6.3): shared by the exercise sheet and the library detail page.
// Order: how it moves, which muscles, what it needs, how to do it, tips, your last sessions, swap, demo, source.
import { useEffect, useState } from 'react';
import { getExercise, listExercises } from '../../data/exercises';
import { movementPattern, type Exercise } from '../../domain/exercise';
import type { Plan } from '../../domain/plan';
import { replaceExercise, planExerciseIds } from '../../domain/plan';
import type { EquipmentChoice, Workout } from '../../domain/types';
import { swapCandidates } from '../coach/domain/swap';

const SWAP_CHOICES = 3; // suggestions to flip through before swapping
import { getRepo } from '../training/data';
import { readSheetContext, type SheetContext } from './sheet-context';
import { Button, Card } from '../../ui/primitives';
import { toast } from '../../ui/controls';
import { ExerciseMedia } from '../../ui/ExerciseMedia';
import { BodyMap } from '../../ui/body/BodyMap';
import { LEVEL_LABEL, PLAN_CHANGED_EVENT, kitLabel, mechanicLabel } from './labels';
import { recentSessions, sourceLine, youtubeSearchUrl } from './exercise-facts';

// The saved plan and history, read once per opened exercise and never written (sheet-context.ts). Failures leave
// the sections out, never the sheet.
function useTrainingContext() {
  const [ctx, setCtx] = useState<SheetContext | null>(null);
  useEffect(() => {
    let alive = true;
    getRepo()
      .then((repo) => readSheetContext(repo, Date.now(), listExercises()))
      .then((c) => alive && setCtx(c))
      .catch(() => alive && setCtx(null));
    return () => {
      alive = false;
    };
  }, []);
  return [ctx, setCtx] as const;
}

// A swap is shown before it happens (owner request 2026-11-07): the suggested exercise with its picture or muscles,
// what it needs and how it is done, then Swap in my plan, Another one, or Not now.
function SwapButton({
  ex,
  plan,
  workouts,
  avoid,
  equipment,
  now,
  onSwapped,
  sex,
}: {
  ex: Exercise;
  plan: Plan;
  workouts: Workout[];
  avoid: string[];
  equipment: EquipmentChoice[];
  now: number;
  onSwapped: (p: Plan) => void;
  sex?: 'male' | 'female';
}) {
  const [open, setOpen] = useState(false);
  const [k, setK] = useState(0);
  const inPlan = new Set(planExerciseIds(plan));
  if (!inPlan.has(ex.id)) return null;
  const lastUsed = new Map<string, number>();
  for (const w of workouts) for (const e of w.entries) lastUsed.set(e.exerciseId, Math.max(lastUsed.get(e.exerciseId) ?? 0, w.start));
  // Same movement pattern only, like the coach's swaps (CLAUDE.md swap rule).
  const pattern = movementPattern(ex);
  const options =
    pattern === 'unknown'
      ? []
      : swapCandidates({ exercise: ex, catalogue: listExercises(), inPlan, avoid: new Set(avoid), equipment, lastUsed, now }, Infinity)
          .filter((c) => movementPattern(c) === pattern)
          .slice(0, SWAP_CHOICES);
  if (options.length === 0) return null;
  const to = options[k % options.length];
  const swap = async () => {
    try {
      // The plan as saved now, not as it was when the sheet opened: an edit made since must not be lost.
      const repo = await getRepo();
      const latest = (await repo.getPlan()) ?? plan;
      if (!planExerciseIds(latest).includes(ex.id) || planExerciseIds(latest).includes(to.id)) {
        toast('Your plan changed. Open the exercise again to see a swap.');
        setOpen(false);
        return;
      }
      const next = replaceExercise(latest, ex.id, to.id, now); // `now`: when the sheet opened, render must stay pure
      await repo.savePlan(next);
      onSwapped(next);
      setOpen(false);
      window.dispatchEvent(new Event(PLAN_CHANGED_EVENT));
      toast(`Swapped for ${to.name} in your plan.`);
    } catch {
      toast('Could not swap that exercise. Try again.');
    }
  };
  if (!open) {
    return (
      <Button variant="secondary" onClick={() => setOpen(true)}>
        See a swap
      </Button>
    );
  }
  return (
    <Card title={`Swap for ${to.name}?`} className="swap-preview">
      {to.media ? <ExerciseMedia media={to.media} name={to.name} /> : <BodyMap primary={to.muscles.primary} secondary={to.muscles.secondary} sex={sex} />}
      <p className="muted small">
        {kitLabel(to)}
        {to.level ? ` · ${LEVEL_LABEL[to.level]}` : ''}
        {to.mechanic ? ` · ${mechanicLabel(to)}` : ''}
      </p>
      {to.instructions[0] && <p className="small">{to.instructions[0]}</p>}
      <div className="ui-row">
        <Button onClick={() => void swap()}>Swap in my plan</Button>
        {options.length > 1 && (
          <Button variant="secondary" onClick={() => setK(k + 1)}>
            Another one
          </Button>
        )}
        <Button variant="ghost" onClick={() => setOpen(false)}>
          Not now
        </Button>
      </div>
    </Card>
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
      <BodyMap primary={ex.muscles.primary} secondary={ex.muscles.secondary} sex={ctx?.sex} />

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
        {ctx?.plan && <SwapButton ex={ex} plan={ctx.plan} workouts={ctx.workouts} avoid={ctx.blocked} equipment={ctx.equipment} now={ctx.now} onSwapped={(plan) => setCtx({ ...ctx, plan })} sex={ctx.sex} />}
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
