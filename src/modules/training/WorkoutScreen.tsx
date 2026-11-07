// Today's session (UX design §6.4). Three stages: a preview you can edit, logging (focus or list view, one tap per
// pre-filled set), and the finish summary. The session in progress is kept on the device after every change, so a
// killed iOS PWA does not lose it; only Finish saves a Workout.
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { getExercise, listExercises } from '../../data/exercises';
import { isDeloadWeek, nextSession, sessionStarts, sessionsInBlock } from '../../domain/block';
import { CARDIO } from '../../config/thresholds';
import { cardioXp, makeCardio, type CardioSession } from '../../domain/cardio';
import { loadKind } from '../../domain/exercise';
import { buildLive, canFinish, currentPosition, logSet, nextSetDefaults, setRir, toEntries, undoLastSet, type LiveExercise } from '../../domain/live-session';
import type { Plan } from '../../domain/plan';
import { blockedIds, equipmentOf, workoutViewOf } from '../../domain/profile';
import type { BodyweightEntry, Settings, Workout } from '../../domain/types';
import { CoachCards } from '../coach/CoachCards';
import { scheduleRestAlert, cancelRestAlert } from '../push/actions';
import { WeeklyReview } from '../review/ui/WeeklyReview';
import { isLivePr, summarize, type SessionSummary } from '../xp/domain/sessionSummary';
import { loadProgress } from '../progress/load';
import { afterSet, supersetLabel } from '../../domain/superset';
import { unlockSound } from '../../ui/sound';
import { levelOf } from '../xp/domain/hub';
import { Button, Card } from '../../ui/primitives';
import { SegmentedControl } from '../../ui/controls';
import { ExerciseName } from '../library/ExerciseSheet';
import { getDb, getRepo, getLocalRepo, defaultSettings, currentPlan, historyFor, ownedWeightsFor, repRangeFor } from './data';
import { clearDraft, isRestorable, readDraft, writeDraft } from './draft';
import { DayEditor } from './DayEditor';
import { FinishSummary } from './FinishSummary';
import { prescribeFor } from './prescribe';
import { RestBar } from './RestBar';
import { startRest, type RestTimer } from './rest-timer';
import { RirPicker } from './RirPicker';
import { SetControls } from './SetControls';
import { CardioLog } from './CardioLog';
import { usePlanEditor } from './usePlanEditor';

type Stage = 'preview' | 'logging' | 'summary';
type Values = { w: number; r: number };

interface Loaded {
  settings: Settings;
  workouts: Workout[];
  bodyweight: BodyweightEntry[];
  dayIndex: number;
  deload: boolean;
}

// Logged sets in one scrolling row. It jumps to the newest set only when one is added, not on every render (the rest
// timer re-renders each second), so earlier sets stay reachable.
function SetChips({ count, children }: { count: number; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    el?.scrollTo({ left: el.scrollWidth });
  }, [count]);
  return (
    <div ref={ref} className="ui-set-chips" role="list" aria-label="Sets" tabIndex={0}>
      {children}
    </div>
  );
}

// The clock is read here, outside render.
const nowMs = () => Date.now();

export default function WorkoutScreen() {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [stage, setStage] = useState<Stage>('preview');
  const [live, setLive] = useState<LiveExercise[]>([]);
  const [startedAt, setStartedAt] = useState(0);
  const [view, setView] = useState<'focus' | 'list'>('focus');
  const [focus, setFocus] = useState(0);
  const [pending, setPending] = useState<Record<string, Values>>({}); // stepper edits before the next ✓
  const [rest, setRest] = useState<RestTimer | null>(null);
  const [tick, setTick] = useState(nowMs);
  const [editing, setEditing] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [summary, setSummary] = useState<SessionSummary | null>(null);
  const [levelUp, setLevelUp] = useState<{ from: number; to: number } | null>(null);
  const [status, setStatus] = useState('');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0); // bumped after Done, so the next session loads fresh
  const [cardioDone, setCardioDone] = useState<CardioSession | null>(null); // today's planned cardio day, once logged
  const [postCardio, setPostCardio] = useState<CardioSession | null>(null); // the cardio after today's lifting, once logged
  const { edit, error: saveError } = usePlanEditor(plan, setPlan);

  // Load settings, history and today's day, and pick up a session that was in progress. Failures are shown.
  useEffect(() => {
    (async () => {
      const repo = await getRepo();
      const s = (await repo.getSettings()) ?? defaultSettings();
      const ws = await repo.listWorkouts();
      const p = await currentPlan(repo, await getLocalRepo(), s);
      const at = nowMs();
      // Finished sessions: lifting workouts and finished planned cardio days (not extra or post-lift cardio).
      const starts = sessionStarts(ws, await repo.listCardio());
      const today = nextSession(p, sessionsInBlock(p, starts.map((start) => ({ start }))), at, starts);
      if (!today) {
        setLoadError('No plan days yet. Build a plan on the Plan tab.');
        return;
      }
      setLoaded({ settings: s, workouts: ws, bodyweight: await repo.listBodyweight(), dayIndex: today.index, deload: isDeloadWeek(p, at) });
      setPlan(p);
      setView(workoutViewOf(s));
      const draft = await readDraft(await getDb());
      if (draft && today.kind !== 'cardio' && isRestorable(draft, today.index, at)) {
        setLive(draft.exercises);
        setStartedAt(draft.startedAt);
        setStage('logging');
      }
    })().catch(() => setLoadError('Could not load today’s session. Reload the page to try again.'));
  }, [reloadKey]);

  // Keep the session in progress on the device after every change.
  useEffect(() => {
    if (stage !== 'logging' || !loaded || !plan) return;
    void getDb().then((db) => writeDraft(db, { dayIndex: loaded.dayIndex, startedAt, exercises: live }));
  }, [live, stage, startedAt, loaded, plan]);

  // Tick once a second while a rest runs (wall-clock based, see rest-timer.ts).
  useEffect(() => {
    if (!rest) return;
    const t = setInterval(() => setTick(nowMs()), 1000);
    return () => clearInterval(t);
  }, [rest]);

  if (loadError) return <p className="muted">{loadError}</p>;
  if (!loaded || !plan) return <p className="muted">Loading…</p>;

  const { settings } = loaded;
  const day = plan.days.find((d) => d.index === loaded.dayIndex) ?? plan.days[0];
  const names = Object.fromEntries(listExercises().map((e) => [e.id, e.name]));

  const prescriptions = () =>
    day.exerciseIds.map((id) => {
      const ex = getExercise(id);
      return { exercise: ex, prescription: ex ? prescribeFor({ plan, day, ex, settings, workouts: loaded.workouts, now: nowMs() }) : { w: 0, reps: 0, sets: 0 } };
    });

  const start = () => {
    const items = buildLive(prescriptions());
    if (items.length === 0) {
      setStatus('Nothing in this day can be logged. Edit the day first.');
      return;
    }
    setLive(items);
    setStartedAt(nowMs());
    setFocus(0);
    setEditing(false);
    setStatus('');
    setStage('logging');
  };

  const valuesFor = (le: LiveExercise): Values => pending[le.exerciseId] ?? nextSetDefaults(le);

  const log = (i: number) => {
    const le = live[i];
    const at = nowMs();
    const next = live.map((x, k) => (k === i ? logSet(x, valuesFor(x), at) : x));
    setLive(next);
    setPending(({ [le.exerciseId]: _used, ...others }) => others);
    setConfirmDiscard(false);
    // Supersets: go straight to the next exercise of the round; rest only after the round's last set.
    const step = afterSet(day, le.exerciseId, (id) => {
      const x = next.find((e) => e.exerciseId === id);
      return x ? Math.max(0, x.prescription.sets - x.sets.length) : 0;
    });
    if (step.next) {
      const to = next.findIndex((e) => e.exerciseId === step.next);
      if (to !== -1) setFocus(to);
    }
    if (!step.rest) {
      setRest(null);
      cancelRestAlert().catch(() => undefined);
      return;
    }
    const timer = startRest(at, settings.restSec);
    setRest(timer);
    setTick(at);
    // The rest-end push (PLAN Phase 9). The on-screen timer runs either way; a failure is said, not hidden.
    if (timer) {
      scheduleRestAlert(timer.endsAt).catch((e: unknown) =>
        setStatus(`Rest alert not scheduled: ${e instanceof Error ? e.message : 'unknown error'}`),
      );
    } else {
      cancelRestAlert().catch(() => undefined);
    }
  };

  // The set logged most recently, across exercises: what Undo takes back and what the RIR picker belongs to.
  let last: { exercise: number; set: number; at: number } | null = null;
  live.forEach((e, i) => {
    const s = e.sets.at(-1);
    if (s && (!last || s.at > last.at)) last = { exercise: i, set: e.sets.length - 1, at: s.at };
  });
  const lastSet = last as { exercise: number; set: number; at: number } | null;

  const undo = () => {
    if (!lastSet) return;
    setLive(live.map((x, k) => (k === lastSet.exercise ? undoLastSet(x) : x)));
    setFocus(lastSet.exercise); // a superset may have moved on: undo goes back to the set it takes back
    setRest(null);
    cancelRestAlert().catch(() => undefined);
  };

  const finish = async () => {
    unlockSound(); // inside the tap: iOS plays the level-up sound only from a context resumed here
    const ok = canFinish(live);
    if (!ok.ok) {
      setStatus(ok.error);
      return;
    }
    try {
      const workout: Workout = { id: `w_${startedAt}`, start: startedAt, end: nowMs(), entries: toEntries(live) };
      const repo = await getRepo();
      // Player level before and after, for the celebration (U7). A failed read only skips the moment.
      const levelNow = () => loadProgress().then((l) => levelOf(l.totalXp).level).catch(() => null);
      const levelBefore = await levelNow();
      await repo.saveWorkout(workout);
      const levelAfter = await levelNow();
      setLevelUp(levelBefore !== null && levelAfter !== null && levelAfter > levelBefore ? { from: levelBefore, to: levelAfter } : null);
      // A finished workout ends any pending rest alert and the draft. A failed cancel must not block saving.
      cancelRestAlert().catch(() => undefined);
      await clearDraft(await getDb());
      setSummary(
        summarize({
          workouts: loaded.workouts,
          workout,
          exerciseById: getExercise,
          bodyweight: loaded.bodyweight,
          daysPerWeek: settings.daysPerWeek,
          repMaxFor: (id) => {
            const ex = getExercise(id);
            return ex ? repRangeFor(ex).max : 0;
          },
          now: nowMs(),
        }),
      );
      setRest(null);
      setStage('summary');
    } catch {
      setStatus('Could not save the workout. Nothing was lost: try Finish again.');
    }
  };

  const discard = async () => {
    await clearDraft(await getDb());
    cancelRestAlert().catch(() => undefined);
    setLive([]);
    setRest(null);
    setConfirmDiscard(false);
    setStage('preview');
  };

  // Home and Train share this screen, so leaving by hash alone would keep the summary: reset it and load again.
  const leave = () => {
    setSummary(null);
    setLive([]);
    setPending({});
    setCardioDone(null);
    setPostCardio(null);
    setStage('preview');
    setLoaded(null);
    setReloadKey((k) => k + 1);
    window.location.hash = '#/home';
  };

  if (stage === 'summary' && summary) {
    return (
      <FinishSummary
        summary={summary}
        levelUp={levelUp ?? undefined}
        names={names}
        sex={settings.about?.sex ?? 'male'}
        onDone={leave}
        extra={
          day.postCardioMinutes ? (
            <Card title="Cardio after lifting">
              {postCardio ? (
                <p>Logged: {postCardio.minutes} min, +{cardioXp(postCardio)} XP. It belongs to this session, so it does not count as another one.</p>
              ) : (
                <CardioLog
                  defaults={{ type: 'walk', minutes: day.postCardioMinutes }}
                  onSave={async (v) => {
                    const c = makeCardio(v, nowMs(), { afterWorkoutId: `w_${startedAt}` });
                    await (await getRepo()).saveCardio(c);
                    setPostCardio(c);
                  }}
                />
              )}
            </Card>
          ) : null
        }
      />
    );
  }

  const title = day.label ?? `Day ${day.index + 1}`;

  if (day.kind === 'cardio') {
    const planned = day.cardio ?? { type: 'walk' as const, minutes: CARDIO.defaultMinutes };
    return (
      <section className="ui-stack">
        <h1>Today · {title}</h1>
        <Card title="Cardio day">
          {cardioDone ? (
            <>
              <p>Logged: {cardioDone.minutes} min, +{cardioXp(cardioDone)} XP. This day counts toward this week’s target.</p>
              <Button block onClick={leave}>
                Done
              </Button>
            </>
          ) : (
            <>
              <p className="muted">
                Planned: {CARDIO.types.find((t) => t.value === planned.type)?.label ?? 'Cardio'}, {planned.minutes} min.
              </p>
              <CardioLog
                defaults={planned}
                saveLabel="Log cardio day"
                onSave={async (v) => {
                  const c = makeCardio(v, nowMs(), { planDay: day.index });
                  await (await getRepo()).saveCardio(c);
                  setCardioDone(c);
                }}
              />
            </>
          )}
        </Card>
      </section>
    );
  }

  if (stage === 'preview') {
    const items = prescriptions();
    return (
      <section className="ui-stack">
        <h1>Today · {title}</h1>
        {loaded.deload && <p className="muted">Deload week: lighter work so you come back fresh.</p>}
        <WeeklyReview />
        <CoachCards />
        <Card title="Warm-up">
          <ul className="ui-list">
            {day.warmup.map((r) => (
              <li key={r.name}>
                <span>{r.name}</span>
                <span className="muted small">{Math.round(r.seconds / 60)} min</span>
              </li>
            ))}
          </ul>
        </Card>
        <Card
          title="Exercises"
          action={
            <Button size="sm" variant="ghost" onClick={() => setEditing(!editing)}>
              {editing ? 'Done editing' : 'Edit day'}
            </Button>
          }
        >
          {editing ? (
            <DayEditor plan={plan} day={day} equipment={equipmentOf(settings)} blocked={[...blockedIds(settings, listExercises())]} onEdit={edit} />
          ) : (
            <ol className="ui-list ui-list--numbered">
              {items.map(({ exercise, prescription }, i) => (
                <li key={day.exerciseIds[i]} className="ui-list-stack">
                  <ExerciseName id={day.exerciseIds[i]} name={exercise?.name ?? day.exerciseIds[i]} />
                  <span className="muted small">
                    {prescription.sets} × {prescription.reps}
                    {exercise && loadKind(exercise) !== 'none' ? ` at ${prescription.w} kg` : ''}
                  </span>
                </li>
              ))}
            </ol>
          )}
          {saveError && <p className="error">{saveError}</p>}
        </Card>
        {(day.postCardioMinutes || day.mobilityMinutes) && (
          <p className="muted">
            {day.postCardioMinutes ? `After lifting: ${day.postCardioMinutes} min of easy cardio. ` : ''}
            {day.mobilityMinutes ? `Mobility: ${day.mobilityMinutes} min.` : ''}
          </p>
        )}
        {status && <p className="error">{status}</p>}
        <Button block onClick={start}>
          Start workout
        </Button>
      </section>
    );
  }

  const pos = currentPosition(live);
  const card = (le: LiveExercise, i: number) => {
    const open = i === focus;
    const ex = getExercise(le.exerciseId);
    const weighted = !!ex && loadKind(ex) !== 'none';
    const history = historyFor(loaded.workouts, le.exerciseId);
    const isCurrent = pos?.exercise === i;
    const done = le.sets.length >= le.prescription.sets;
    const v = valuesFor(le);
    const target = le.mode === 'time' ? `${le.prescription.sets} × ${le.prescription.reps} s` : `${le.prescription.sets} × ${le.prescription.reps}${weighted ? ` at ${le.prescription.w} kg` : ''}`;
    return (
      <article key={le.exerciseId} className={`ui-card ui-live${isCurrent ? ' ui-live--current' : ''}${done && !open ? ' ui-live--idle' : ''}`}>
        <h2 onClick={() => setFocus(i)}>
          <ExerciseName id={le.exerciseId} name={names[le.exerciseId] ?? le.exerciseId} />
          {supersetLabel(day, le.exerciseId) && <span className="pe-ss ui-live-ss">Superset {supersetLabel(day, le.exerciseId)}</span>}
        </h2>
        <p className="muted">Target {target}</p>
        <SetChips count={le.sets.length}>
          {le.sets.map((s, k) => (
            <span key={`${s.at}-${k}`} className="ui-set-chip" role="listitem">
              {le.mode === 'time' ? `${s.r} s` : `${weighted ? `${s.w} × ` : ''}${s.r}`}
              {s.rir !== undefined && ` · ${s.rir === 4 ? '4+' : s.rir} left`}
              {isLivePr(le, history, k) && <span className="ui-pr-badge">PR</span>}
            </span>
          ))}
          {!done && <span className="ui-set-chip ui-set-chip--next" role="listitem">Set {le.sets.length + 1}</span>}
        </SetChips>
        {open && (
          <>
            <SetControls
              mode={le.mode}
              weighted={weighted}
              w={v.w}
              r={v.r}
              owned={ex ? ownedWeightsFor(ex, settings) : []}
              setNumber={le.sets.length + 1}
              setsTotal={le.prescription.sets}
              onChange={(nv) => setPending({ ...pending, [le.exerciseId]: nv })}
              onLog={() => log(i)}
            />
            {/* Always rendered, so logging a set does not push the page down; it rates the last set of this exercise. */}
            <RirPicker
              disabled={!(lastSet && lastSet.exercise === i)}
              value={lastSet && lastSet.exercise === i ? le.sets[lastSet.set]?.rir : undefined}
              onChange={(rir) => lastSet && setLive(live.map((x, k) => (k === i ? setRir(x, lastSet.set, rir) : x)))}
            />
          </>
        )}
      </article>
    );
  };

  const shown = view === 'focus' ? [focus] : live.map((_, i) => i);
  const logged = live.reduce((n, e) => n + e.sets.length, 0);
  return (
    <section className="ui-stack ui-pad-rest">
      <h1>
        {title} · {logged} {logged === 1 ? 'set' : 'sets'}
      </h1>
      <SegmentedControl
        label="Workout view"
        options={[
          { value: 'focus', label: 'Focus' },
          { value: 'list', label: 'List' },
        ]}
        value={view}
        onChange={setView}
      />
      {shown.map((i) => card(live[i], i))}
      {view === 'focus' && (
        <div className="ui-row">
          <Button variant="secondary" disabled={focus === 0} onClick={() => setFocus(focus - 1)}>
            Previous
          </Button>
          <span className="muted">
            Exercise {focus + 1} of {live.length}
          </span>
          <Button variant="secondary" disabled={focus >= live.length - 1} onClick={() => setFocus(focus + 1)}>
            Next
          </Button>
        </div>
      )}
      {(day.postCardioMinutes || day.mobilityMinutes) && (
        <p className="muted">
          {day.postCardioMinutes ? `After lifting: ${day.postCardioMinutes} min of easy cardio. ` : ''}
          {day.mobilityMinutes ? `Mobility: ${day.mobilityMinutes} min.` : ''}
        </p>
      )}
      {status && <p className="error">{status}</p>}
      <div className="ui-row">
        <Button variant="secondary" disabled={!lastSet} onClick={undo}>
          Undo last set
        </Button>
        <Button onClick={finish}>Finish workout</Button>
        {confirmDiscard ? (
          <Button variant="danger" onClick={discard}>
            Yes, discard
          </Button>
        ) : (
          <Button variant="ghost" onClick={() => setConfirmDiscard(true)}>
            Discard
          </Button>
        )}
      </div>
      {rest && <RestBar endsAt={rest.endsAt} now={tick} onSkip={() => { setRest(null); cancelRestAlert().catch(() => undefined); }} />}
    </section>
  );
}
