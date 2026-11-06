import { describe, it, expect } from 'vitest';
import { saveProfilePatch, parseSetInput, isIsoDate } from './validate';
import type { Settings } from '../../domain/types';

describe('saveProfilePatch', () => {
  it('merges the patch into the stored settings and keeps everything else', async () => {
    let stored: Settings = { daysPerWeek: 3, restSec: 90, owned: [4], onboardedAt: 5, reminder: { enabled: true, time: '07:00' } };
    const repo = {
      getSettings: async () => stored,
      saveSettings: async (s: Settings) => {
        stored = s;
      },
    };
    const out = await saveProfilePatch(repo, { goals: ['lose-fat'], equipment: ['dumbbell', 'band'] });
    expect(stored).toEqual({
      daysPerWeek: 3,
      restSec: 90,
      owned: [4],
      onboardedAt: 5,
      reminder: { enabled: true, time: '07:00' },
      goals: ['lose-fat'],
      equipment: ['dumbbell', 'band'],
    });
    expect(out).toEqual(stored);
  });

  it('starts from defaults when nothing is stored yet', async () => {
    let stored: Settings | undefined;
    const repo = {
      getSettings: async () => stored,
      saveSettings: async (s: Settings) => {
        stored = s;
      },
    };
    await saveProfilePatch(repo, { goals: ['health'] });
    expect(stored?.goals).toEqual(['health']);
    expect(stored?.daysPerWeek).toBeGreaterThan(0);
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
