// Credits shown on the Credits screen. Each source's licence and what we took from it (DATA_SOURCES §1-§2).
export interface CreditEntry {
  name: string;
  url: string;
  licence: string;
  uses: string;
}

export const CREDITS: readonly CreditEntry[] = [
  {
    name: 'free-exercise-db',
    url: 'https://github.com/yuhonas/free-exercise-db',
    licence: 'Unlicense (public domain)',
    uses: 'Exercise names, muscles, equipment, instructions. Images are not used: their licence is not stated.',
  },
];
