// First-run interview (SPEC §2, §8.2 screen 1). Each answer is saved as it is given, so nothing is lost if the user
// leaves. Finishing sets onboardedAt and moves on to Today. The questions are the core six plus bodyweight (decided).
import { useEffect, useState } from 'react';
import { listExercises } from '../../data/exercises';
import { getRepo, defaultSettings } from '../training/data';
import { parseSettingsForm } from '../training/validate';
import type { Settings } from '../../domain/types';
import { ProposePlan } from '../ai/ui/ProposePlan';

const STEPS = ['goal', 'days', 'session', 'owned', 'experience', 'avoid', 'bodyweight', 'plan'] as const;
type Step = (typeof STEPS)[number];

const todayIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export default function Onboarding() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [i, setI] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState({ days: '3', owned: '', avoid: '', bodyweight: '' });

  useEffect(() => {
    (async () => {
      const repo = await getRepo();
      const s = (await repo.getSettings()) ?? defaultSettings();
      setSettings(s);
      setDraft((d) => ({ ...d, days: String(s.daysPerWeek), owned: s.owned.join(', ') }));
    })().catch(() => setError('Could not load your settings. Reload to try again.'));
  }, []);

  if (!settings) return <p className="muted">{error ?? 'Loading…'}</p>;
  const step: Step = STEPS[i];

  // Saves the answer for this step, then moves on. Returns false (and says why) when the answer is not usable.
  const next = async (patch?: () => Promise<Partial<Settings> | null> | Partial<Settings> | null | false): Promise<void> => {
    setError(null);
    try {
      const result = patch ? await patch() : {};
      if (result === false) return;
      if (result) {
        const repo = await getRepo();
        const merged = { ...settings, ...result };
        await repo.saveSettings(merged);
        setSettings(merged);
      }
      setI((n) => Math.min(n + 1, STEPS.length - 1));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save that. Try again.');
    }
  };

  const setGoal = (goal: NonNullable<Settings['goal']>) => next(() => ({ goal }));
  const setSession = (sessionMinutes: number) => next(() => ({ sessionMinutes }));
  const setExperience = (experience: NonNullable<Settings['experience']>) => next(() => ({ experience }));

  const saveDays = () => {
    const parsed = parseSettingsForm({ days: draft.days, rest: String(settings.restSec), owned: settings.owned.join(', ') });
    if (!parsed.ok) {
      setError(parsed.error);
      return false as const;
    }
    return { daysPerWeek: parsed.value.daysPerWeek };
  };

  const saveOwned = () => {
    const parsed = parseSettingsForm({ days: String(settings.daysPerWeek), rest: String(settings.restSec), owned: draft.owned });
    if (!parsed.ok) {
      setError(parsed.error);
      return false as const;
    }
    return { owned: parsed.value.owned };
  };

  // Avoid list: names matched to the library. Anything not found is shown, never dropped silently.
  const saveAvoid = () => {
    const names = draft.avoid
      .split(',')
      .map((t) => t.trim().toLowerCase())
      .filter((t) => t.length > 0);
    const byName = new Map(listExercises().map((e) => [e.name.toLowerCase(), e.id]));
    const missing = names.filter((n) => !byName.has(n));
    if (missing.length > 0) {
      setError(`Not in the library: ${missing.join(', ')}. Fix the names or leave them out.`);
      return false as const;
    }
    return { avoid: names.map((n) => byName.get(n) as string) };
  };

  const saveBodyweight = async () => {
    const t = draft.bodyweight.trim();
    if (t === '') return {};
    const kg = Number(t);
    if (!Number.isFinite(kg) || kg <= 0) {
      setError('Bodyweight is a number in kg, or leave it empty.');
      return false as const;
    }
    await (await getRepo()).addBodyweight(todayIso(), kg);
    return {};
  };

  return (
    <section>
      <p className="muted small">
        Step {i + 1} of {STEPS.length}
      </p>

      {step === 'goal' && (
        <Question title="What do you want most?">
          <Choice onPick={() => setGoal('build-muscle')} label="Build muscle (strength is secondary)" />
          <Choice onPick={() => setGoal('strength')} label="Get stronger (muscle is secondary)" />
        </Question>
      )}

      {step === 'days' && (
        <Question title="How many days a week can you train?">
          <input type="number" min={1} max={7} value={draft.days} onChange={(e) => setDraft({ ...draft, days: e.target.value })} aria-label="Days per week" />
          <button type="button" onClick={() => next(saveDays)}>
            Next
          </button>
        </Question>
      )}

      {step === 'session' && (
        <Question title="How long is a session?">
          <Choice onPick={() => setSession(30)} label="About 30 minutes" />
          <Choice onPick={() => setSession(45)} label="About 45 minutes" />
          <Choice onPick={() => setSession(60)} label="About an hour" />
        </Question>
      )}

      {step === 'owned' && (
        <Question title="Which dumbbell weights do you own (kg)?">
          <p className="muted small">Separate them with commas, for example 4, 6, 8, 10, 12, 14, 16.</p>
          <input value={draft.owned} onChange={(e) => setDraft({ ...draft, owned: e.target.value })} aria-label="Owned weights" />
          <button type="button" onClick={() => next(saveOwned)}>
            Next
          </button>
        </Question>
      )}

      {step === 'experience' && (
        <Question title="How much training have you done recently?">
          <Choice onPick={() => setExperience('returning')} label="I am returning after a break" />
          <Choice onPick={() => setExperience('beginner')} label="I am new to this" />
          <Choice onPick={() => setExperience('intermediate')} label="I train regularly" />
        </Question>
      )}

      {step === 'avoid' && (
        <Question title="Any exercises to avoid? (optional)">
          <p className="muted small">Exercise names, separated by commas. Leave empty if none.</p>
          <input value={draft.avoid} onChange={(e) => setDraft({ ...draft, avoid: e.target.value })} aria-label="Exercises to avoid" />
          <button type="button" onClick={() => next(saveAvoid)}>
            Next
          </button>
        </Question>
      )}

      {step === 'bodyweight' && (
        <Question title="Your bodyweight in kg (optional)">
          <p className="muted small">Used for strength ranks. You can add it later in Progress.</p>
          <input type="number" value={draft.bodyweight} onChange={(e) => setDraft({ ...draft, bodyweight: e.target.value })} aria-label="Bodyweight" />
          <button type="button" onClick={() => next(saveBodyweight)}>
            Next
          </button>
        </Question>
      )}

      {step === 'plan' && (
        <ProposePlan
          settings={settings}
          onSaved={async () => {
            await (await getRepo()).saveSettings({ ...settings, onboardedAt: Date.now() });
            window.location.hash = '#/today';
          }}
        />
      )}

      {error && <p className="error">{error}</p>}
      {i > 0 && step !== 'plan' && (
        <button type="button" onClick={() => setI(i - 1)}>
          Back
        </button>
      )}
    </section>
  );
}

function Question(props: { title: string; children: React.ReactNode }) {
  return (
    <div className="question">
      <h2>{props.title}</h2>
      {props.children}
    </div>
  );
}

function Choice(props: { label: string; onPick: () => void }) {
  return (
    <button type="button" className="choice" onClick={props.onPick}>
      {props.label}
    </button>
  );
}
