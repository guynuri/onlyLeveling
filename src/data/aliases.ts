// RepDB id → free-exercise-db id, for the same exercise under two different names (catalogue-merge.ts).
// Names that match after normaliseName() need no entry. Add a pair when the library shows a duplicate. The rp_ id
// keeps resolving to the fx record (getExercise → lookupExercise), so history that logged it is not orphaned:
//   'rp_goblet-squat': 'fx_Goblet_Squat',
export const ALIASES: Readonly<Record<string, string>> = {};
