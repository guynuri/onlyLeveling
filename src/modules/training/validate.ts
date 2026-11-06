// Input checks for the training screens. Pure, so the rules are tested. Each returns a message, never throws.
import type { Settings } from '../../domain/types';
import type { Template, TemplateDay } from '../../domain/template';

export type Parsed<T> = { ok: true; value: T } | { ok: false; error: string };

const INT = /^\d+$/;

export function parseSettingsForm(f: { days: string; rest: string; owned: string }): Parsed<Settings> {
  const days = f.days.trim();
  if (!INT.test(days) || Number(days) < 1 || Number(days) > 7) {
    return { ok: false, error: 'Days per week must be a whole number from 1 to 7.' };
  }
  const rest = f.rest.trim();
  if (!INT.test(rest)) {
    return { ok: false, error: 'Rest must be a whole number of seconds (0 turns it off).' };
  }
  const tokens = f.owned.split(/[,\s]+/).filter((t) => t.length > 0);
  if (tokens.length === 0) {
    return { ok: false, error: 'Enter at least one dumbbell weight.' };
  }
  const owned: number[] = [];
  for (const t of tokens) {
    const n = Number(t);
    if (!Number.isFinite(n) || n <= 0) {
      return { ok: false, error: `"${t}" is not a dumbbell weight in kg.` };
    }
    owned.push(n);
  }
  return {
    ok: true,
    value: { daysPerWeek: Number(days), restSec: Number(rest), owned: [...new Set(owned)].sort((a, b) => a - b) },
  };
}

// The Settings form changes three fields; everything else (onboarding answers, reminder) is kept. Saving the bare
// parse result used to drop onboardedAt and send the user back through onboarding.
export function applySettingsForm(current: Settings, f: { days: string; rest: string; owned: string }): Parsed<Settings> {
  const parsed = parseSettingsForm(f);
  return parsed.ok ? { ok: true, value: { ...current, ...parsed.value } } : parsed;
}

// Saves the Settings form on top of what is stored now. The screen's own copy is only a fallback: a reminder saved on
// the same screen, or a sync pull after it opened, must not be overwritten by a stale copy.
export async function saveSettingsForm(
  repo: { getSettings(): Promise<Settings | null | undefined>; saveSettings(s: Settings): Promise<void> },
  fallback: Settings,
  f: { days: string; rest: string; owned: string },
): Promise<Parsed<Settings>> {
  const parsed = applySettingsForm((await repo.getSettings()) ?? fallback, f);
  if (parsed.ok) await repo.saveSettings(parsed.value);
  return parsed;
}

// One logged set. A blank, non-numeric, zero or fractional entry is refused, never logged as done.
export function parseSetInput(weightText: string, repsText: string): Parsed<{ w: number; r: number }> {
  const wt = weightText.trim();
  const w = wt === '' ? NaN : Number(wt);
  if (!Number.isFinite(w) || w <= 0) {
    return { ok: false, error: 'Enter the weight in kg (more than 0).' };
  }
  const rt = repsText.trim();
  if (!INT.test(rt) || Number(rt) < 1) {
    return { ok: false, error: 'Enter the reps done (at least 1).' };
  }
  return { ok: true, value: { w, r: Number(rt) } };
}

// YYYY-MM-DD and a real calendar date.
export function isIsoDate(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  return !Number.isNaN(Date.parse(`${s}T00:00:00Z`));
}

// Today's plan day: the finished-session count, cycling through the plan. Null when the plan has no days.
export function todayFromTemplate(template: Template, finishedSessions: number): TemplateDay | null {
  if (template.days.length === 0) return null;
  return template.days[finishedSessions % template.days.length];
}
