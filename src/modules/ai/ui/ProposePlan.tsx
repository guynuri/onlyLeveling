// The first-plan proposal (SPEC §5, §8.2): show the plan with its corrections, then let the user choose. Nothing is
// saved until a choice is made. A rules plan is labelled "Built by rules; AI unavailable." whenever the AI did not answer.
import { useState } from 'react';
import { getExercise } from '../../../data/exercises';
import type { Correction, ValidPlan } from '../../../../shared/ai-plan';
import type { Settings } from '../../../domain/types';
import { TEMPLATE } from '../../../config/thresholds';
import { buildPlanRequest } from '../domain/request';
import { planFromProposal } from '../domain/apply';
import { listExercises } from '../../../data/exercises';
import { requestProposal, rulesPlan, saveChosenPlan, type Proposal } from '../actions';
import { CopyPasteFallback } from './CopyPasteFallback';

type Preview = { kind: 'ai'; plan: ValidPlan; corrections: Correction[] } | { kind: 'rules'; reason: string };

const REASON: Record<string, string> = {
  'signed-out': 'Sign in to a server to use the AI.',
  unreachable: 'The AI could not be reached.',
  invalid: 'The AI answer did not pass the checks.',
  capped: 'You have used today’s plan proposals.',
  none: 'No AI provider is set up.',
};

export function ProposePlan(props: { settings: Settings; onSaved: () => void }) {
  const [preview, setPreview] = useState<Preview | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const request = buildPlanRequest(props.settings, listExercises(), TEMPLATE.exercisesPerDay);

  const toPreview = (p: Proposal): Preview =>
    p.status === 'ai' ? { kind: 'ai', plan: p.plan, corrections: p.corrections } : { kind: 'rules', reason: p.reason };

  const propose = async () => {
    setBusy(true);
    setError(null);
    try {
      setPreview(toPreview(await requestProposal(props.settings)));
    } catch {
      setPreview({ kind: 'rules', reason: 'unreachable' });
    } finally {
      setBusy(false);
    }
  };

  const save = async (plan: Preview | null) => {
    setBusy(true);
    setError(null);
    try {
      const now = Date.now();
      if (plan?.kind === 'ai') await saveChosenPlan(planFromProposal(plan.plan, props.settings.daysPerWeek, now));
      else await saveChosenPlan(rulesPlan(props.settings, now));
      props.onSaved();
    } catch {
      setError('Could not save the plan. Try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section>
      <h2>Your first plan</h2>
      {!preview && (
        <>
          <p className="muted">The AI proposes a plan from your answers. Your rules plan is always there as an alternative.</p>
          <button type="button" onClick={propose} disabled={busy}>
            Propose a plan
          </button>
          <button type="button" onClick={() => save(null)} disabled={busy}>
            Use the rules plan
          </button>
        </>
      )}

      {preview?.kind === 'rules' && (
        <p className="label">
          Built by rules; AI unavailable. <span className="muted small">{REASON[preview.reason] ?? ''}</span>
        </p>
      )}

      {preview?.kind === 'ai' && (
        <>
          <h3>{preview.plan.name}</h3>
          {preview.plan.days.map((d) => (
            <div key={d.label} className="plan-day">
              <h4>{d.label}</h4>
              <ol>
                {d.exercises.map((e) => (
                  <li key={e.exerciseId}>
                    {getExercise(e.exerciseId)?.name ?? e.exerciseId} · {e.w} kg · {e.sets} × {e.reps}
                    <div className="muted small">{e.reason}</div>
                  </li>
                ))}
              </ol>
            </div>
          ))}
          {preview.corrections.length > 0 && (
            <div className="muted small">
              <p>Corrected to fit your setup:</p>
              <ul>
                {preview.corrections.map((c) => (
                  <li key={c.path + c.why}>
                    {c.from} → {c.to} ({c.why})
                  </li>
                ))}
              </ul>
            </div>
          )}
          <p className="muted small">{preview.plan.note}</p>
        </>
      )}

      {preview && (
        <div className="choices">
          {preview.kind === 'ai' && (
            <button type="button" onClick={() => save(preview)} disabled={busy}>
              Use this plan
            </button>
          )}
          <button type="button" onClick={() => save({ kind: 'rules', reason: '' })} disabled={busy}>
            Use the rules plan
          </button>
          <button type="button" onClick={propose} disabled={busy}>
            Propose again
          </button>
        </div>
      )}

      <CopyPasteFallback
        request={request}
        onValid={(plan, corrections) => setPreview({ kind: 'ai', plan, corrections })}
      />

      {error && <p className="error">{error}</p>}
    </section>
  );
}
