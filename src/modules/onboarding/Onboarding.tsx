// Onboarding v2 (UX design §4). Required: until all nine steps are done (the plan step sets onboardedV2At) the app
// keeps coming back here. Each Continue saves that step's answer on top of the stored settings, so leaving halfway
// loses nothing and the next run starts pre-filled. A new account starts with nothing ticked, weights included.
import { useEffect, useState } from 'react';
import { PROFILE } from '../../config/thresholds';
import { ALL_STEPS, equipmentOf, goalsOf, onboardingDone, parseAbout, validateWeights, type Step } from '../../domain/profile';
import { SYNC_EVENT } from '../sync/actions';
import type { BodyPart, EquipmentChoice, Goal, Settings } from '../../domain/types';
import { Button } from '../../ui/primitives';
import { getRepo, defaultSettings } from '../training/data';
import { saveProfilePatch } from '../training/validate';
import { ProposePlan } from '../ai/ui/ProposePlan';
import {
  AboutStep,
  DaysStep,
  EquipmentStep,
  ExperienceStep,
  GoalsStep,
  LimitsStep,
  SessionStep,
  StepFrame,
  WeightsStep,
  type AboutDraft,
} from './steps';

const todayIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

interface Draft {
  goals: Goal[];
  about: AboutDraft;
  experience: Settings['experience'];
  days: number;
  session: number | undefined;
  equipment: EquipmentChoice[];
  owned: number[];
  kettlebells: number[];
  limits: { parts: BodyPart[]; note: string };
}

function draftFrom(s: Settings): Draft {
  return {
    goals: s.goals ?? (s.goal ? goalsOf(s) : []),
    about: {
      sex: s.about?.sex ?? '',
      age: s.about?.age?.toString() ?? '',
      heightCm: s.about?.heightCm?.toString() ?? '',
      weightKg: '',
    },
    experience: s.experience,
    days: s.daysPerWeek,
    session: s.sessionMinutes,
    equipment: equipmentOf(s),
    owned: [...s.owned],
    kettlebells: [...(s.ownedKettlebells ?? [])],
    limits: s.limits ?? { parts: [], note: '' },
  };
}

export default function Onboarding() {
  const steps = ALL_STEPS;
  const [draft, setDraft] = useState<Draft | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [i, setI] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getRepo()
      .then((r) => r.getSettings())
      .then((saved) => {
        // No stored settings: a new account, so no default weights are ticked for the user.
        const s = saved ?? { ...defaultSettings(), owned: [] };
        setSettings(s);
        setDraft(draftFrom(s));
      })
      .catch(() => setError('Could not load your settings. Reload to try again.'));
  }, []);

  // Settings pulled from the server while this screen is open (another phone answered, or a new phone's first sync)
  // replace the draft, so a Continue never saves stale or blank answers over them. Our own saves come back equal and
  // are ignored. When the pull leaves nothing to answer, onboarding is over.
  useEffect(() => {
    if (!settings) return;
    const onSync = () => {
      getRepo()
        .then((r) => r.getSettings())
        .then((fresh) => {
          if (!fresh || JSON.stringify(fresh) === JSON.stringify(settings)) return;
          if (onboardingDone(fresh)) {
            window.location.hash = '#/home';
            return;
          }
          setSettings(fresh);
          setDraft(draftFrom(fresh));
        })
        .catch(() => undefined);
    };
    window.addEventListener(SYNC_EVENT, onSync);
    return () => window.removeEventListener(SYNC_EVENT, onSync);
  }, [settings]);

  if (!draft || !settings) return <p className="muted">{error ?? 'Loading…'}</p>;
  const step = steps[i];
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft({ ...draft, [k]: v });

  // What this step saves, or an error that keeps the user on it.
  const patchFor = async (): Promise<Partial<Settings> | string> => {
    switch (step) {
      case 'goals':
        return draft.goals.length > 0 ? { goals: draft.goals } : 'Pick at least one goal.';
      case 'about': {
        const r = parseAbout(draft.about);
        if (!r.ok) return r.error;
        if (r.value.weightKg !== null) await (await getRepo()).addBodyweight(todayIso(), r.value.weightKg);
        return { about: r.value.about };
      }
      case 'experience':
        return draft.experience ? { experience: draft.experience } : 'Pick the one that fits best.';
      case 'days':
        return { daysPerWeek: draft.days };
      case 'session':
        return draft.session ? { sessionMinutes: draft.session } : 'Pick a session length.';
      case 'equipment':
        return { equipment: draft.equipment };
      case 'weights': {
        const err = validateWeights(draft.equipment, draft.owned, draft.kettlebells);
        return err ?? { owned: draft.owned, ownedKettlebells: draft.kettlebells };
      }
      case 'limits':
        return { limits: { parts: draft.limits.parts, note: draft.limits.note.slice(0, PROFILE.limitsNoteMax) } };
      case 'plan':
        return {};
    }
  };

  const next = async () => {
    setError(null);
    setBusy(true);
    try {
      const patch = await patchFor();
      if (typeof patch === 'string') {
        setError(patch);
        return;
      }
      setSettings(await saveProfilePatch(await getRepo(), patch));
      setI(i + 1);
    } catch {
      setError('Could not save that. Try again.');
    } finally {
      setBusy(false);
    }
  };

  const skippable = step === 'about' || step === 'limits';

  return (
    <section className="ob-pad">
      <div className="ob-dots" role="img" aria-label={`Step ${i + 1} of ${steps.length}`}>
        {steps.map((s, k) => (
          <span key={s} className="ob-dot" data-on={k <= i} />
        ))}
      </div>

      {step === 'goals' && (
        <StepFrame eyebrow="Your goals" title="What are you training for?" why="Pick as many as you like. They count equally and shape your plan.">
          <GoalsStep value={draft.goals} onChange={(v) => set('goals', v)} />
          <p className="muted small">
            Already have an account? <a href="#/settings">Sign in</a> and your settings come back.
          </p>
        </StepFrame>
      )}
      {step === 'about' && (
        <StepFrame eyebrow="About you" title="A little about you" why="Picks your body figure and starts your bodyweight log. Skip anything.">
          <AboutStep value={draft.about} onChange={(v) => set('about', v)} />
        </StepFrame>
      )}
      {step === 'experience' && (
        <StepFrame eyebrow="Experience" title="Where are you starting from?" why="Sets how light to start and how fast to progress.">
          <ExperienceStep value={draft.experience} onChange={(v) => set('experience', v)} />
        </StepFrame>
      )}
      {step === 'days' && (
        <StepFrame eyebrow="Schedule" title="How many days a week?" why="Pick what you will actually keep, not your best week.">
          <DaysStep value={draft.days} onChange={(v) => set('days', v)} />
        </StepFrame>
      )}
      {step === 'session' && (
        <StepFrame eyebrow="Session length" title="How long is a session?" why="The plan fits the work, including rest, into this time.">
          <SessionStep value={draft.session} onChange={(v) => set('session', v)} />
        </StepFrame>
      )}
      {step === 'equipment' && (
        <StepFrame eyebrow="Equipment" title="What do you have at home?" why="The library and your plans only offer what you can do.">
          <EquipmentStep value={draft.equipment} onChange={(v) => set('equipment', v)} />
        </StepFrame>
      )}
      {step === 'weights' && (
        <StepFrame eyebrow="Weights" title="Which weights do you own?" why="Progression only ever suggests a weight you have. Tap each one.">
          {draft.equipment.includes('dumbbell') && (
            <WeightsStep label="Dumbbell weights, kg" grid={PROFILE.dumbbellGrid} value={draft.owned} onChange={(v) => set('owned', v)} />
          )}
          {draft.equipment.includes('kettlebell') && (
            <WeightsStep label="Kettlebell weights, kg" grid={PROFILE.kettlebellGrid} value={draft.kettlebells} onChange={(v) => set('kettlebells', v)} />
          )}
          {!draft.equipment.includes('dumbbell') && !draft.equipment.includes('kettlebell') && (
            <p className="muted">No weights to pick: your equipment has no dumbbells or kettlebells.</p>
          )}
        </StepFrame>
      )}
      {step === 'limits' && (
        <StepFrame eyebrow="Limits" title="Anything to work around?" why="Sore joints, old injuries, movements you avoid. Optional.">
          <LimitsStep value={draft.limits} onChange={(v) => set('limits', v)} />
        </StepFrame>
      )}
      {step === 'plan' && (
        <ProposePlan
          settings={settings}
          onSaved={async () => {
            // Choosing a plan is the last step: only now is onboarding finished.
            const now = Date.now();
            await saveProfilePatch(await getRepo(), { onboardedAt: now, onboardedV2At: now });
            window.location.hash = '#/home';
          }}
        />
      )}

      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}

      {step !== 'plan' && (
        <div className="ob-foot">
          {i > 0 ? (
            <Button variant="ghost" onClick={() => setI(i - 1)} disabled={busy}>
              Back
            </Button>
          ) : (
            <span />
          )}
          <Button onClick={next} disabled={busy}>
            {skippable && isBlank(step, draft) ? 'Skip' : 'Continue'}
          </Button>
        </div>
      )}
    </section>
  );
}

function isBlank(step: Step, d: Draft): boolean {
  if (step === 'about') return !d.about.sex && !d.about.age && !d.about.heightCm && !d.about.weightKg;
  if (step === 'limits') return d.limits.parts.length === 0 && !d.limits.note.trim();
  return false;
}
