// Stored shapes (SPEC §7, PLAN Phase 3). Kept with the domain so the repo and screens share one definition.
import type { Prescription } from './progression';
import type { SetRow } from './session';

export interface Settings {
  daysPerWeek: number;
  restSec: number; // 0 = rest timer off
  owned: number[]; // owned dumbbell weights, kg
  // Onboarding answers (SPEC §2). Optional: settings saved before onboarding have none of them.
  goal?: 'build-muscle' | 'strength';
  sessionMinutes?: number;
  experience?: 'returning' | 'beginner' | 'intermediate';
  avoid?: string[]; // exercise ids that never appear in plans or swaps
  onboardedAt?: number; // set when the interview is finished
  reminder?: { enabled: boolean; time: string }; // workout reminder, HH:MM local time (SPEC §6.4)
}

export interface Entry {
  exerciseId: string;
  planned: Prescription; // the target the plan asked for this session
  sets: SetRow[];
}

// One finished session. Saved whole; a later edit replaces the whole session (last write wins, SPEC §6.2).
export interface Workout {
  id: string;
  start: number; // epoch ms
  end: number; // epoch ms
  entries: Entry[];
}

export interface BodyweightEntry {
  date: string; // YYYY-MM-DD
  kg: number;
}
