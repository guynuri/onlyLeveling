// Display text for the library. Unknown values are shown as "Unknown", never guessed (PLAN Phase 2 risks).
import { isEquipmentFree, type Equipment, type Exercise, type Kit, type Level, type MovementPattern } from '../../domain/exercise';

export const KIT_LABEL: Record<Kit, string> = {
  dumbbell: 'Dumbbells',
  kettlebell: 'Kettlebell',
  bench: 'Bench',
  pullup_bar: 'Pull-up bar',
  band: 'Band',
};

// What the exercise needs, in words: "Dumbbells + Bench", "No equipment", or the equipment name ("Barbell").
export function kitLabel(ex: Pick<Exercise, 'equipment' | 'requires'>): string {
  if (ex.requires.length > 0) return ex.requires.map((k) => KIT_LABEL[k]).join(' + ');
  return isEquipmentFree(ex) ? 'No equipment' : EQUIPMENT_LABEL[ex.equipment];
}

// The event Plan listens for when the exercise sheet changes the saved plan (a swap).
export const PLAN_CHANGED_EVENT = 'plan-changed';

export const EQUIPMENT_LABEL: Record<Equipment, string> = {
  barbell: 'Barbell',
  dumbbell: 'Dumbbell',
  kettlebell: 'Kettlebell',
  cable: 'Cable',
  machine: 'Machine',
  bodyweight: 'Bodyweight',
  band: 'Band',
  other: 'Other',
  unknown: 'Unknown',
};

export const PATTERN_LABEL: Record<MovementPattern, string> = {
  push: 'Push',
  pull: 'Pull',
  static: 'Static hold',
  unknown: 'Unknown',
};

export const LEVEL_LABEL: Record<Level, string> = {
  beginner: 'Beginner',
  intermediate: 'Intermediate',
  expert: 'Expert',
};

export function mechanicLabel(ex: Exercise): string {
  if (ex.mechanic === null) return 'Unknown';
  return ex.mechanic === 'compound' ? 'Compound' : 'Isolation';
}
