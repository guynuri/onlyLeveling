import { describe, it, expect } from 'vitest';
import { parseSettingsForm, applySettingsForm, parseSetInput, isIsoDate, todayFromTemplate } from './validate';

describe('applySettingsForm', () => {
  it('keeps the onboarding answers and reminder when the form is saved', () => {
    const current = {
      daysPerWeek: 3,
      restSec: 90,
      owned: [4, 6],
      goal: 'strength' as const,
      onboardedAt: 123,
      avoid: ['fx_x'],
      reminder: { enabled: true, time: '18:00' },
    };
    const r = applySettingsForm(current, { days: '4', rest: '60', owned: '4, 6, 8' });
    expect(r).toEqual({
      ok: true,
      value: { ...current, daysPerWeek: 4, restSec: 60, owned: [4, 6, 8] },
    });
  });

  it('passes a form error through unchanged', () => {
    const r = applySettingsForm({ daysPerWeek: 3, restSec: 90, owned: [4] }, { days: '9', rest: '60', owned: '4' });
    expect(r.ok).toBe(false);
  });
});

describe('parseSettingsForm', () => {
  const ok = { days: '3', rest: '90', owned: '4, 6, 8' };

  it('accepts a complete, valid form and sorts the owned weights', () => {
    const r = parseSettingsForm({ ...ok, owned: '8, 4, 6' });
    expect(r).toEqual({ ok: true, value: { daysPerWeek: 3, restSec: 90, owned: [4, 6, 8] } });
  });

  it('rejects blank or out-of-range days (an empty field used to store 0)', () => {
    expect(parseSettingsForm({ ...ok, days: '' }).ok).toBe(false);
    expect(parseSettingsForm({ ...ok, days: '0' }).ok).toBe(false);
    expect(parseSettingsForm({ ...ok, days: '8' }).ok).toBe(false);
    expect(parseSettingsForm({ ...ok, days: '2.5' }).ok).toBe(false);
  });

  it('rejects a negative or blank rest; 0 is allowed (rest off)', () => {
    expect(parseSettingsForm({ ...ok, rest: '-1' }).ok).toBe(false);
    expect(parseSettingsForm({ ...ok, rest: '' }).ok).toBe(false);
    expect(parseSettingsForm({ ...ok, rest: '0' }).ok).toBe(true);
  });

  it('rejects owned lists with no valid weight', () => {
    expect(parseSettingsForm({ ...ok, owned: 'abc' }).ok).toBe(false);
    expect(parseSettingsForm({ ...ok, owned: '' }).ok).toBe(false);
  });
});

describe('parseSetInput', () => {
  it('accepts a positive weight and at least one rep', () => {
    expect(parseSetInput('8', '10')).toEqual({ ok: true, value: { w: 8, r: 10 } });
    expect(parseSetInput('7.5', '1')).toEqual({ ok: true, value: { w: 7.5, r: 1 } });
  });

  it('rejects blank, non-numeric, zero or negative weight', () => {
    expect(parseSetInput('', '10').ok).toBe(false);
    expect(parseSetInput('abc', '10').ok).toBe(false);
    expect(parseSetInput('0', '10').ok).toBe(false);
    expect(parseSetInput('-2', '10').ok).toBe(false);
  });

  it('rejects blank, non-integer or zero reps (a blank rep count is not a logged set)', () => {
    expect(parseSetInput('8', '').ok).toBe(false);
    expect(parseSetInput('8', '0').ok).toBe(false);
    expect(parseSetInput('8', '2.5').ok).toBe(false);
  });
});

describe('isIsoDate', () => {
  it('accepts YYYY-MM-DD only', () => {
    expect(isIsoDate('2026-11-05')).toBe(true);
    expect(isIsoDate('')).toBe(false);
    expect(isIsoDate('05/11/2026')).toBe(false);
    expect(isIsoDate('2026-1-5')).toBe(false);
  });
});

describe('todayFromTemplate', () => {
  const template = {
    days: [
      { index: 0, warmup: [], exerciseIds: ['a'], cooldown: [] },
      { index: 1, warmup: [], exerciseIds: ['b'], cooldown: [] },
    ],
  };

  it('picks the day by finished-session count, cycling through the plan', () => {
    expect(todayFromTemplate(template, 0)?.index).toBe(0);
    expect(todayFromTemplate(template, 3)?.index).toBe(1);
  });

  it('returns null for an empty plan instead of throwing', () => {
    expect(todayFromTemplate({ days: [] }, 0)).toBeNull();
  });
});
