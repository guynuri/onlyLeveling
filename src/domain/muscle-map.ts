// Muscle vocabularies (UX design §3.2). Three sources name muscles three ways; this file maps them onto
// (a) free-exercise-db names, which XP groups read (xp/domain/muscles.ts), and (b) body-map slugs, which the
// MuscleMap figure draws. Pure tables, tested.

// The muscles the body map draws (openGym lib/muscles.js MUSCLES, from MuscleMap).
export const BODY_SLUGS = [
  'trapezius', 'deltoids', 'chest', 'upper-back', 'serratus',
  'biceps', 'triceps', 'forearm',
  'abs', 'obliques', 'lower-back',
  'gluteal', 'quadriceps', 'hamstring', 'adductors', 'hip-flexors',
  'calves', 'tibialis',
] as const;
export type BodySlug = (typeof BODY_SLUGS)[number];

export const SLUG_LABEL: Record<BodySlug, string> = {
  trapezius: 'Traps',
  deltoids: 'Shoulders',
  chest: 'Chest',
  'upper-back': 'Upper back',
  serratus: 'Serratus',
  biceps: 'Biceps',
  triceps: 'Triceps',
  forearm: 'Forearms',
  abs: 'Abs',
  obliques: 'Obliques',
  'lower-back': 'Lower back',
  gluteal: 'Glutes',
  quadriceps: 'Quads',
  hamstring: 'Hamstrings',
  adductors: 'Adductors',
  'hip-flexors': 'Hip flexors',
  calves: 'Calves',
  tibialis: 'Shins',
};

// free-exercise-db muscle → slugs. 'neck' has no slug.
export const FX_TO_SLUG: Record<string, BodySlug[]> = {
  abdominals: ['abs'],
  abductors: ['gluteal'],
  adductors: ['adductors'],
  biceps: ['biceps'],
  calves: ['calves'],
  chest: ['chest'],
  forearms: ['forearm'],
  glutes: ['gluteal'],
  hamstrings: ['hamstring'],
  lats: ['upper-back'],
  'lower back': ['lower-back'],
  'middle back': ['upper-back'],
  quadriceps: ['quadriceps'],
  shoulders: ['deltoids'],
  traps: ['trapezius'],
  triceps: ['triceps'],
};

// RepDB muscle → free-exercise-db muscle (for XP).
export const REPDB_TO_FX: Record<string, string> = {
  abductors: 'abductors',
  adductors: 'adductors',
  anterior_deltoid: 'shoulders',
  lateral_deltoid: 'shoulders',
  posterior_deltoid: 'shoulders',
  infraspinatus_teres_minor: 'shoulders',
  supraspinatus: 'shoulders',
  biceps_brachii: 'biceps',
  brachialis: 'biceps',
  brachioradialis: 'forearms',
  forearm_extensors: 'forearms',
  forearm_flexors: 'forearms',
  forearms: 'forearms',
  erector_spinae: 'lower back',
  quadratus_lumborum: 'lower back',
  gastrocnemius: 'calves',
  soleus: 'calves',
  tibialis_anterior: 'calves',
  gluteus_maximus: 'glutes',
  gluteus_medius: 'glutes',
  hamstrings: 'hamstrings',
  hip_flexors: 'quadriceps',
  quadriceps: 'quadriceps',
  latissimus_dorsi: 'lats',
  rhomboids: 'middle back',
  trapezius: 'traps',
  obliques: 'abdominals',
  rectus_abdominis: 'abdominals',
  transverse_abdominis: 'abdominals',
  pectoralis_major: 'chest',
  serratus_anterior: 'chest',
  triceps_brachii: 'triceps',
};

// RepDB muscle → body-map slug (finer than the XP mapping: hip flexors, shins and serratus have their own shapes).
export const REPDB_TO_SLUG: Record<string, BodySlug> = {
  abductors: 'gluteal',
  adductors: 'adductors',
  anterior_deltoid: 'deltoids',
  lateral_deltoid: 'deltoids',
  posterior_deltoid: 'deltoids',
  infraspinatus_teres_minor: 'deltoids',
  supraspinatus: 'deltoids',
  biceps_brachii: 'biceps',
  brachialis: 'biceps',
  brachioradialis: 'forearm',
  forearm_extensors: 'forearm',
  forearm_flexors: 'forearm',
  forearms: 'forearm',
  erector_spinae: 'lower-back',
  quadratus_lumborum: 'lower-back',
  gastrocnemius: 'calves',
  soleus: 'calves',
  tibialis_anterior: 'tibialis',
  gluteus_maximus: 'gluteal',
  gluteus_medius: 'gluteal',
  hamstrings: 'hamstring',
  hip_flexors: 'hip-flexors',
  quadriceps: 'quadriceps',
  latissimus_dorsi: 'upper-back',
  rhomboids: 'upper-back',
  trapezius: 'trapezius',
  obliques: 'obliques',
  rectus_abdominis: 'abs',
  transverse_abdominis: 'abs',
  pectoralis_major: 'chest',
  serratus_anterior: 'serratus',
  triceps_brachii: 'triceps',
};

// openGym target / secondary muscle → free-exercise-db muscle (for XP). Unknown names map to nothing.
export const OG_TARGET_TO_FX: Record<string, string> = {
  glutes: 'glutes',
  delts: 'shoulders',
  shoulders: 'shoulders',
  abs: 'abdominals',
  quads: 'quadriceps',
  quadriceps: 'quadriceps',
  pectorals: 'chest',
  chest: 'chest',
  'upper back': 'middle back',
  biceps: 'biceps',
  triceps: 'triceps',
  lats: 'lats',
  obliques: 'abdominals',
  core: 'abdominals',
  hamstrings: 'hamstrings',
  calves: 'calves',
  forearms: 'forearms',
  traps: 'traps',
  trapezius: 'traps',
  spine: 'lower back',
  'lower back': 'lower back',
  abductors: 'abductors',
  adductors: 'adductors',
  'levator scapulae': 'traps',
  shins: 'calves',
  'hip flexors': 'quadriceps',
  'serratus anterior': 'chest',
};

export function isBodySlug(s: string): s is BodySlug {
  return (BODY_SLUGS as readonly string[]).includes(s);
}

// free-exercise-db names → body-map slugs, deduped, first-seen order. Unknown names are skipped.
export function slugsOf(fxMuscles: readonly string[]): BodySlug[] {
  return [...new Set(fxMuscles.flatMap((m) => FX_TO_SLUG[m] ?? []))];
}
