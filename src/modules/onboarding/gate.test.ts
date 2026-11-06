import { describe, it, expect } from 'vitest';
import { needsOnboarding } from './gate';
import type { Settings } from '../../domain/types';

const done: Settings = { daysPerWeek: 4, restSec: 90, owned: [8], onboardedAt: 1, onboardedV2At: 2 };

describe('needsOnboarding', () => {
  it('decides on the settings after the first sync, so a signed-in new phone restores instead of re-onboarding', async () => {
    let stored: Settings | undefined; // empty local copy on a new phone
    const order: string[] = [];
    const pending = await needsOnboarding(
      async () => {
        order.push('sync');
        stored = done; // the pull brings the server copy
      },
      async () => {
        order.push('read');
        return stored;
      },
    );
    expect(order).toEqual(['sync', 'read']);
    expect(pending).toBe(false);
  });

  it('still decides when the sync fails (offline): the local copy counts', async () => {
    const pending = await needsOnboarding(
      async () => {
        throw new Error('offline');
      },
      async () => undefined,
    );
    expect(pending).toBe(true);
  });
});
