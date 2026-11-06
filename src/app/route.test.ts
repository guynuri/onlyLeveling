import { describe, it, expect } from 'vitest';
import { parseRoute, tabFor, allowedWhileOnboarding } from './route';

describe('parseRoute', () => {
  it('defaults to home for an empty or unknown hash', () => {
    expect(parseRoute('')).toEqual({ screen: 'home' });
    expect(parseRoute('#')).toEqual({ screen: 'home' });
    expect(parseRoute('#/nope')).toEqual({ screen: 'home' });
  });

  it('old #/today links land on home', () => {
    expect(parseRoute('#/today')).toEqual({ screen: 'home' });
  });

  it('maps the new tab screens', () => {
    expect(parseRoute('#/workout')).toEqual({ screen: 'workout' });
    expect(parseRoute('#/progress')).toEqual({ screen: 'progress' });
    expect(parseRoute('#/more')).toEqual({ screen: 'more' });
  });

  it('maps tab hashes, with or without the leading slash', () => {
    expect(parseRoute('#/history')).toEqual({ screen: 'history' });
    expect(parseRoute('#history')).toEqual({ screen: 'history' });
  });

  it('library list and library detail', () => {
    expect(parseRoute('#/library')).toEqual({ screen: 'library' });
    expect(parseRoute('#/library/fx_Dumbbell_Curl')).toEqual({ screen: 'exercise', id: 'fx_Dumbbell_Curl' });
  });

  it('credits screen', () => {
    expect(parseRoute('#/credits')).toEqual({ screen: 'credits' });
  });

  it('a malformed % escape falls back to the library list instead of throwing', () => {
    expect(parseRoute('#/library/100%')).toEqual({ screen: 'library' });
    expect(parseRoute('#/library/%E0%A4%A')).toEqual({ screen: 'library' });
  });

  it('decodes an encoded exercise id', () => {
    expect(parseRoute('#/library/fx_a%20b')).toEqual({ screen: 'exercise', id: 'fx_a b' });
  });
});

describe('allowedWhileOnboarding', () => {
  it('only onboarding itself and Settings (to sign in on a new phone) are reachable before onboarding is finished', () => {
    expect(allowedWhileOnboarding({ screen: 'onboarding' })).toBe(true);
    expect(allowedWhileOnboarding({ screen: 'settings' })).toBe(true);
    for (const r of [{ screen: 'home' }, { screen: 'plan' }, { screen: 'workout' }, { screen: 'library' }, { screen: 'exercise', id: 'x' }] as const)
      expect(allowedWhileOnboarding(r)).toBe(false);
  });
});

describe('tabFor', () => {
  it('highlights More for its sub-screens', () => {
    for (const r of [{ screen: 'library' }, { screen: 'history' }, { screen: 'settings' }, { screen: 'credits' }, { screen: 'exercise', id: 'x' }] as const)
      expect(tabFor(r)).toBe('more');
  });
  it('highlights Home during onboarding and the tab itself otherwise', () => {
    expect(tabFor({ screen: 'onboarding' })).toBe('home');
    expect(tabFor({ screen: 'workout' })).toBe('workout');
  });
});
