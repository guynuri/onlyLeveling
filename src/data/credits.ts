// Credits shown on the Credits screen. Each source's licence and what we took from it (DATA_SOURCES §1-§2).
export interface CreditEntry {
  name: string;
  url: string;
  licence: string;
  uses: string;
}

export const CREDITS: readonly CreditEntry[] = [
  {
    name: 'Exercise data by RepDB (repdb.co)',
    url: 'https://repdb.co',
    licence: 'RepDB Free Tier License v1.0',
    uses: 'Exercise pictures (start and end positions), names, muscles, instructions and tips.',
  },
  {
    name: 'MuscleMap by Melih Colpan',
    url: 'https://github.com/melihcolpan/MuscleMap',
    licence: 'MIT',
    uses: 'The front and back body figures that show which muscles an exercise works.',
  },
  {
    name: 'openGym exercise catalogue',
    url: 'https://github.com/DuarteSantos8/openGym',
    licence: 'AGPL-3.0 (openGym text) and MIT (ExerciseDB text)',
    uses: 'Extra dumbbell exercises: names, muscles, descriptions and instructions. No pictures.',
  },
  {
    name: 'free-exercise-db',
    url: 'https://github.com/yuhonas/free-exercise-db',
    licence: 'Unlicense (public domain)',
    uses: 'Exercise names, muscles, equipment, instructions. Images are not used: their licence is not stated.',
  },
  {
    name: 'Lucide icons',
    url: 'https://lucide.dev',
    licence: 'ISC',
    uses: 'Icons in the tab bar and screens.',
  },
];
