// Display text for the library. Unknown values are shown as "Unknown", never guessed (PLAN Phase 2 risks).
import type { Equipment, Exercise, Level, MovementPattern } from '../../domain/exercise';

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
