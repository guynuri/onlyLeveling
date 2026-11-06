// Whether the app should open onboarding. It waits for the first sync on purpose: deciding on the local copy before
// the server's settings arrive sent a signed-in user on a new phone through onboarding again (overwriting their plan
// and weights), and sent a second phone through the v2 questions with stale answers that then synced back up.
// A failed sync (offline, signed out) falls back to the local copy.
import { onboardingDone } from '../../domain/profile';
import { TRAINING } from '../../config/thresholds';
import type { Settings } from '../../domain/types';

export async function needsOnboarding(sync: () => Promise<unknown>, read: () => Promise<Settings | undefined>): Promise<boolean> {
  try {
    await sync();
  } catch {
    // Offline or signed out: the local copy decides.
  }
  const s = (await read()) ?? { daysPerWeek: TRAINING.defaultDaysPerWeek, restSec: TRAINING.restSec, owned: [] };
  return !onboardingDone(s);
}
