// Onboarding v2 steps (UX design §4), shared with Settings. Each is controlled: value + onChange, no saving here.
import type { ReactNode } from 'react';
import { Activity, Dumbbell, Flame, HeartPulse, Move, Trophy } from 'lucide-react';
import type { BodyPart, EquipmentChoice, Goal, Settings } from '../../domain/types';
import { toggleIn } from '../../ui/select';
import { Button, Chip, ChipGroup, ChoiceCard } from '../../ui/primitives';
import { SegmentedControl } from '../../ui/controls';

export function StepFrame(props: { eyebrow: string; title: string; why: string; children: ReactNode }) {
  return (
    <div className="ob-step">
      <p className="ob-eyebrow">{props.eyebrow}</p>
      <h1 className="ob-title">{props.title}</h1>
      <p className="ob-why">{props.why}</p>
      <div className="ui-stack">{props.children}</div>
    </div>
  );
}

const GOALS: readonly { value: Goal; title: string; sub: string; icon: ReactNode }[] = [
  { value: 'build-muscle', title: 'Build muscle', sub: 'Grow size, rep ranges in the middle', icon: <Dumbbell /> },
  { value: 'strength', title: 'Get stronger', sub: 'Heavier weights, fewer reps', icon: <Trophy /> },
  { value: 'lose-fat', title: 'Lose fat', sub: 'Adds cardio sessions to the plan', icon: <Flame /> },
  { value: 'endurance', title: 'Endurance', sub: 'More reps and longer cardio', icon: <Activity /> },
  { value: 'mobility', title: 'Mobility', sub: 'Short mobility blocks each session', icon: <Move /> },
  { value: 'health', title: 'General health', sub: 'A bit of everything, sustainably', icon: <HeartPulse /> },
];

export function GoalsStep(props: { value: readonly Goal[]; onChange: (v: Goal[]) => void }) {
  return (
    <>
      {GOALS.map((g) => (
        <ChoiceCard
          key={g.value}
          selected={props.value.includes(g.value)}
          onSelect={() => props.onChange(toggleIn(props.value, g.value))}
          title={g.title}
          sub={g.sub}
          icon={g.icon}
        />
      ))}
    </>
  );
}

export interface AboutDraft {
  sex: string;
  age: string;
  heightCm: string;
  weightKg: string;
}

export function AboutStep(props: { value: AboutDraft; onChange: (v: AboutDraft) => void }) {
  const set = (k: keyof AboutDraft) => (e: { target: { value: string } }) => props.onChange({ ...props.value, [k]: e.target.value });
  return (
    <>
      <SegmentedControl
        label="Body figure"
        options={[
          { value: 'male', label: 'Male' },
          { value: 'female', label: 'Female' },
          { value: '', label: 'Skip' },
        ]}
        value={props.value.sex}
        onChange={(sex) => props.onChange({ ...props.value, sex })}
      />
      <div className="ob-fields">
        <label className="field">
          Age
          <input inputMode="numeric" value={props.value.age} onChange={set('age')} />
        </label>
        <label className="field">
          Height, cm
          <input inputMode="decimal" value={props.value.heightCm} onChange={set('heightCm')} />
        </label>
        <label className="field">
          Weight, kg
          <input inputMode="decimal" value={props.value.weightKg} onChange={set('weightKg')} />
        </label>
      </div>
      <p className="muted small">All optional. These stay on your phone; weight starts your bodyweight log.</p>
    </>
  );
}

const EXPERIENCE: readonly { value: NonNullable<Settings['experience']>; title: string; sub: string }[] = [
  { value: 'beginner', title: 'New to this', sub: 'Start light and learn the moves' },
  { value: 'returning', title: 'Coming back after a break', sub: 'Ease in, progress quickly' },
  { value: 'intermediate', title: 'I train regularly', sub: 'Pick up where you are' },
];

export function ExperienceStep(props: { value: Settings['experience']; onChange: (v: NonNullable<Settings['experience']>) => void }) {
  return (
    <>
      {EXPERIENCE.map((e) => (
        <ChoiceCard key={e.value} selected={props.value === e.value} onSelect={() => props.onChange(e.value)} title={e.title} sub={e.sub} />
      ))}
    </>
  );
}

export function DaysStep(props: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="ui-chips ob-number-row" role="group" aria-label="Days per week">
      {[1, 2, 3, 4, 5, 6, 7].map((n) => (
        <Chip key={n} selected={props.value === n} onToggle={() => props.onChange(n)}>
          {n}
        </Chip>
      ))}
    </div>
  );
}

export function SessionStep(props: { value: number | undefined; onChange: (v: number) => void }) {
  return (
    <div className="ui-chips" role="group" aria-label="Session length">
      {[30, 45, 60, 75, 90].map((m) => (
        <Chip key={m} selected={props.value === m} onToggle={() => props.onChange(m)}>
          {m} min
        </Chip>
      ))}
    </div>
  );
}

const EQUIPMENT: readonly { value: EquipmentChoice; label: string }[] = [
  { value: 'dumbbell', label: 'Dumbbells' },
  { value: 'kettlebell', label: 'Kettlebell' },
  { value: 'bench', label: 'Bench' },
  { value: 'pullup_bar', label: 'Pull-up bar' },
  { value: 'band', label: 'Bands' },
];

export function EquipmentStep(props: { value: readonly EquipmentChoice[]; onChange: (v: EquipmentChoice[]) => void }) {
  return (
    <>
      <ChipGroup label="Equipment you own" options={EQUIPMENT} value={props.value} onChange={props.onChange} />
      <p className="muted small">Floor space and your body weight are always included.</p>
    </>
  );
}

export function WeightsStep(props: { label: string; grid: readonly number[]; value: readonly number[]; onChange: (v: number[]) => void }) {
  const sorted = (xs: number[]) => [...xs].sort((a, b) => a - b);
  return (
    <div className="ui-stack">
      <ChipGroup
        label={props.label}
        options={props.grid.map((w) => ({ value: w, label: `${w}` }))}
        value={props.value}
        onChange={(v) => props.onChange(sorted(v))}
      />
      <div className="ui-row">
        <Button variant="secondary" size="sm" onClick={() => props.onChange([...props.grid])}>
          Select all
        </Button>
        <Button variant="ghost" size="sm" onClick={() => props.onChange([])}>
          Clear
        </Button>
      </div>
    </div>
  );
}

const PARTS: readonly { value: BodyPart; label: string }[] = [
  { value: 'shoulder', label: 'Shoulder' },
  { value: 'elbow', label: 'Elbow' },
  { value: 'wrist', label: 'Wrist' },
  { value: 'neck', label: 'Neck' },
  { value: 'lower-back', label: 'Lower back' },
  { value: 'hip', label: 'Hip' },
  { value: 'knee', label: 'Knee' },
  { value: 'ankle', label: 'Ankle' },
];

export function LimitsStep(props: { value: { parts: BodyPart[]; note: string }; onChange: (v: { parts: BodyPart[]; note: string }) => void }) {
  return (
    <>
      <ChipGroup label="Body parts to go easy on" options={PARTS} value={props.value.parts} onChange={(parts) => props.onChange({ ...props.value, parts })} />
      <label className="field">
        Anything else? (optional)
        <textarea
          rows={3}
          maxLength={200}
          value={props.value.note}
          placeholder="e.g. no overhead pressing, wrists get sore on push-ups"
          onChange={(e) => props.onChange({ ...props.value, note: e.target.value })}
        />
      </label>
      <p className="muted small">
        Exercises that load these areas are left out of your plans and swaps. This is training guidance, not medical advice: if
        something hurts, see a professional.
      </p>
    </>
  );
}
