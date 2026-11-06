// The onboarding answers, editable in Settings with the same controls (UX design §4). Each card saves only its own
// fields on top of the stored settings; onboarding markers and the plan are never touched here.
import { useState, type ReactNode } from 'react';
import { PROFILE } from '../../config/thresholds';
import { equipmentOf, goalsOf, parseAbout, validateWeights } from '../../domain/profile';
import type { Settings } from '../../domain/types';
import { Button, Card } from '../../ui/primitives';
import { toast } from '../../ui/controls';
import { getRepo } from '../training/data';
import { saveProfilePatch } from '../training/validate';
import { AboutStep, EquipmentStep, GoalsStep, LimitsStep, WeightsStep } from './steps';

const todayIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

function SaveCard(props: { title: string; children: ReactNode; onSave: () => Promise<Partial<Settings> | string> }) {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setError(null);
    setBusy(true);
    try {
      const patch = await props.onSave();
      if (typeof patch === 'string') {
        setError(patch);
        return;
      }
      await saveProfilePatch(await getRepo(), patch);
      toast(`${props.title} saved.`);
    } catch {
      setError('Could not save. Nothing changed; try again.');
    } finally {
      setBusy(false);
    }
  };
  return (
    <Card title={props.title}>
      <div className="ui-stack">
        {props.children}
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <div>
          <Button onClick={save} disabled={busy}>
            Save
          </Button>
        </div>
      </div>
    </Card>
  );
}

export function ProfileSettings({ settings }: { settings: Settings }) {
  const [goals, setGoals] = useState(goalsOf(settings));
  const [about, setAbout] = useState({
    sex: settings.about?.sex ?? '',
    age: settings.about?.age?.toString() ?? '',
    heightCm: settings.about?.heightCm?.toString() ?? '',
    weightKg: '',
  });
  const [equipment, setEquipment] = useState(equipmentOf(settings));
  const [owned, setOwned] = useState([...settings.owned]);
  const [kettlebells, setKettlebells] = useState([...(settings.ownedKettlebells ?? [])]);
  const [limits, setLimits] = useState(settings.limits ?? { parts: [], note: '' });

  return (
    <>
      <SaveCard title="Goals" onSave={async () => (goals.length > 0 ? { goals } : 'Pick at least one goal.')}>
        <GoalsStep value={goals} onChange={setGoals} />
      </SaveCard>

      <SaveCard
        title="About you"
        onSave={async () => {
          const r = parseAbout(about);
          if (!r.ok) return r.error;
          if (r.value.weightKg !== null) await (await getRepo()).addBodyweight(todayIso(), r.value.weightKg);
          setAbout({ ...about, weightKg: '' });
          return { about: r.value.about };
        }}
      >
        <AboutStep value={about} onChange={setAbout} />
      </SaveCard>

      <SaveCard
        title="Equipment and weights"
        onSave={async () => validateWeights(equipment, owned, kettlebells) ?? { equipment, owned, ownedKettlebells: kettlebells }}
      >
        <EquipmentStep value={equipment} onChange={setEquipment} />
        {equipment.includes('dumbbell') && <WeightsStep label="Dumbbell weights, kg" grid={PROFILE.dumbbellGrid} value={owned} onChange={setOwned} />}
        {equipment.includes('kettlebell') && (
          <WeightsStep label="Kettlebell weights, kg" grid={PROFILE.kettlebellGrid} value={kettlebells} onChange={setKettlebells} />
        )}
      </SaveCard>

      <SaveCard title="Limits" onSave={async () => ({ limits: { parts: limits.parts, note: limits.note.slice(0, PROFILE.limitsNoteMax) } })}>
        <LimitsStep value={limits} onChange={setLimits} />
      </SaveCard>
    </>
  );
}
