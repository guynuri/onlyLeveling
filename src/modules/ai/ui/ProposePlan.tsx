// Building a plan (SPEC §5, §8.2; U4): pick a block length, then generate with the AI or start from a template. Whatever
// comes back is only a preview: it is shown (next to the current plan when there is one) and saved only when the user
// confirms it. A rules plan is labelled "Built by rules; AI unavailable." whenever the AI did not answer.
import { useEffect, useState } from 'react';
import { getExercise, listExercises } from '../../../data/exercises';
import type { Correction, ValidPlan } from '../../../../shared/ai-plan';
import type { Plan } from '../../../domain/plan';
import { startBlock } from '../../../domain/plan-edit';
import { buildRulesPlan, type TemplateKind } from '../../../domain/plan-builder';
import { repRangeFor } from '../../../domain/reps';
import type { Settings } from '../../../domain/types';
import { BLOCK, TEMPLATE } from '../../../config/thresholds';
import { buildPlanRequest } from '../domain/request';
import { planFromProposal } from '../domain/apply';
import { getRepo } from '../../training/data';
import { latestBodyweightKg, requestProposal, saveChosenPlan } from '../actions';
import { CopyPasteFallback } from './CopyPasteFallback';
import { Button, Card, ChoiceCard } from '../../../ui/primitives';
import { SegmentedControl } from '../../../ui/controls';
import { ExerciseName } from '../../library/ExerciseSheet';

interface Candidate {
  plan: Plan;
  title: string;
  reason?: string; // set when the AI did not answer and the rules plan stands in
  note?: string;
  corrections: Correction[];
}

const REASON: Record<string, string> = {
  'signed-out': 'Sign in to a server to use the AI.',
  unreachable: 'The AI could not be reached.',
  invalid: 'The AI answer did not pass the checks.',
  capped: 'You have used today’s plan proposals.',
  none: 'No AI provider is set up.',
};

const NO_FIT = 'No exercises fit your equipment and limits. Change them in Settings.';

const TEMPLATE_CHOICES: { kind: TemplateKind | 'auto'; title: string; sub: string }[] = [
  { kind: 'auto', title: 'Best fit for my days', sub: 'Picks full body, upper/lower or push/pull/legs' },
  { kind: 'full-body', title: 'Full body', sub: 'Every session trains the whole body' },
  { kind: 'upper-lower', title: 'Upper / lower', sub: 'Alternates upper and lower body' },
  { kind: 'push-pull-legs', title: 'Push / pull / legs', sub: 'Three-way split' },
];

const repRange = (id: string) => {
  const ex = getExercise(id);
  return ex ? repRangeFor(ex) : { min: 8, max: 12 };
};

const range = (t: { repMin: number; repMax: number }) => (t.repMin === t.repMax ? `${t.repMin}` : `${t.repMin}–${t.repMax}`);

function PlanDays({ plan }: { plan: Plan }) {
  return (
    <>
      {plan.days.map((d) => (
        <Card key={d.index} title={d.label ?? `Day ${d.index + 1}`}>
          <ol className="ui-list ui-list--numbered">
            {d.exerciseIds.map((id) => (
              <li key={id} className="ui-list-stack">
                <span>
                  <ExerciseName id={id} name={getExercise(id)?.name ?? id} />
                  {d.targets?.[id] && (
                    <span className="muted small">
                      {' '}
                      · {d.targets[id].sets} × {range(d.targets[id])}
                    </span>
                  )}
                </span>
              </li>
            ))}
          </ol>
          {(d.postCardioMinutes || d.mobilityMinutes) && (
            <p className="muted small">
              {d.postCardioMinutes ? `Cardio after: ${d.postCardioMinutes} min. ` : ''}
              {d.mobilityMinutes ? `Mobility: ${d.mobilityMinutes} min.` : ''}
            </p>
          )}
        </Card>
      ))}
    </>
  );
}

export function ProposePlan(props: { settings: Settings; onSaved: () => void }) {
  const [weeks, setWeeks] = useState<number>(BLOCK.defaultWeeks);
  const [candidate, setCandidate] = useState<Candidate | null>(null);
  const [current, setCurrent] = useState<Plan | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [bodyweight, setBodyweight] = useState<number | null>(null);
  const [openedAt] = useState(() => Date.now()); // stamps a pasted plan; the block clock restarts on confirm
  useEffect(() => {
    let alive = true;
    void latestBodyweightKg().then((kg) => alive && setBodyweight(kg));
    void getRepo()
      .then((r) => r.getPlan())
      .then((p) => alive && setCurrent(p && p.days.length > 0 ? p : null))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);
  // The copy-paste prompt carries the same summary the Worker gets, body stats included.
  const request = buildPlanRequest(props.settings, listExercises(), TEMPLATE.exercisesPerDay, bodyweight);

  const fromAi = (v: ValidPlan, corrections: Correction[], now: number): Candidate => ({
    plan: planFromProposal(v, props.settings, weeks, repRange, now),
    title: v.name,
    note: v.note,
    corrections,
  });

  const fromRules = (kind: TemplateKind | 'auto', title: string, now: number, reason?: string): Candidate | null => {
    const built = buildRulesPlan({ settings: props.settings, catalogue: listExercises(), kind, weeks, now });
    if (!built.ok) {
      setError(NO_FIT);
      return null;
    }
    return { plan: built.plan, title, reason, corrections: [] };
  };

  const generate = async () => {
    setBusy(true);
    setError(null);
    try {
      const p = await requestProposal(props.settings);
      if (p.status === 'ai') setCandidate(fromAi(p.plan, p.corrections, Date.now()));
      else setCandidate(fromRules('auto', 'Rules plan', Date.now(), p.reason));
    } catch {
      setCandidate(fromRules('auto', 'Rules plan', Date.now(), 'unreachable'));
    } finally {
      setBusy(false);
    }
  };

  const pickTemplate = (kind: TemplateKind | 'auto', title: string) => {
    setError(null);
    const c = fromRules(kind, title, openedAt);
    if (c) setCandidate(c);
  };

  // The block clock starts when the user confirms, not when the preview was made.
  const confirm = async () => {
    if (!candidate) return;
    setBusy(true);
    setError(null);
    try {
      await saveChosenPlan(startBlock(candidate.plan, weeks, Date.now()));
      props.onSaved();
    } catch {
      setError('Could not save the plan. Try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="ui-stack">
      <h2>{current ? 'Build a new plan' : 'Your plan'}</h2>

      {!candidate && (
        <>
          <Card title="How long is the block?">
            <SegmentedControl
              label="Block length in weeks"
              options={BLOCK.lengths.map((w) => ({ value: String(w), label: `${w} wk` }))}
              value={String(weeks)}
              onChange={(v) => setWeeks(Number(v))}
            />
            <p className="muted small">The last week can be a lighter deload week.</p>
          </Card>
          <Card title="Let the AI propose a plan">
            <p className="muted">The AI proposes a plan from your answers. The rules check it before you see it.</p>
            <Button onClick={generate} disabled={busy}>
              Generate with AI
            </Button>
          </Card>
          <Card title="Or start from a template">
            <div className="ui-stack">
              {TEMPLATE_CHOICES.map((t) => (
                <ChoiceCard key={t.kind} selected={false} onSelect={() => pickTemplate(t.kind, t.title)} title={t.title} sub={t.sub} />
              ))}
            </div>
          </Card>
          <CopyPasteFallback request={request} onValid={(v, c) => setCandidate(fromAi(v, c, openedAt))} />
        </>
      )}

      {candidate && (
        <>
          <h3>{candidate.title}</h3>
          {candidate.reason !== undefined && (
            <p className="label">
              Built by rules; AI unavailable. <span className="muted small">{REASON[candidate.reason] ?? ''}</span>
            </p>
          )}
          <PlanDays plan={candidate.plan} />
          {candidate.corrections.length > 0 && (
            <div className="muted small">
              <p>Corrected to fit your setup:</p>
              <ul>
                {candidate.corrections.map((c) => (
                  <li key={c.path + c.why}>
                    {c.from} → {c.to} ({c.why})
                  </li>
                ))}
              </ul>
            </div>
          )}
          {candidate.note && <p className="muted small">{candidate.note}</p>}
          {current && (
            <details>
              <summary>Compare with your current plan</summary>
              <PlanDays plan={current} />
            </details>
          )}
          <p className="muted small">
            {current ? 'Your current plan stays until you replace it. Is this one better for you?' : 'Nothing is saved until you confirm.'}
          </p>
          <div className="ui-row">
            <Button onClick={confirm} disabled={busy}>
              {current ? 'Replace my plan with this one' : 'Use this plan'}
            </Button>
            <Button variant="ghost" onClick={() => setCandidate(null)} disabled={busy}>
              Choose another
            </Button>
          </div>
        </>
      )}

      {error && <p className="error">{error}</p>}
    </section>
  );
}
