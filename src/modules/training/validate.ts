// Input checks for the training screens. Pure, so the rules are tested. Each returns a message, never throws.
import type { Settings } from '../../domain/types';
import { TRAINING } from '../../config/thresholds';
import type { Template, TemplateDay } from '../../domain/template';

export type Parsed<T> = { ok: true; value: T } | { ok: false; error: string };

const INT = /^\d+$/;

// Onboarding steps and Settings cards save a few profile fields at a time, on top of what is stored now (a fresh
// read). With nothing stored yet, the training defaults fill the required fields.
export async function saveProfilePatch(
  repo: { getSettings(): Promise<Settings | null | undefined>; saveSettings(s: Settings): Promise<void> },
  patch: Partial<Settings>,
): Promise<Settings> {
  const current: Settings = (await repo.getSettings()) ?? {
    daysPerWeek: TRAINING.defaultDaysPerWeek,
    restSec: TRAINING.restSec,
    owned: [...TRAINING.defaultOwnedKg],
  };
  const next = { ...current, ...patch };
  await repo.saveSettings(next);
  return next;
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
