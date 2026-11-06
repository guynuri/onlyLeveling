import { describe, it, expect } from 'vitest';
import { REPDB_TO_FX, REPDB_TO_SLUG, OG_TARGET_TO_FX, slugsOf } from './muscle-map';

const REPDB = [
  'abductors', 'adductors', 'anterior_deltoid', 'biceps_brachii', 'brachialis', 'brachioradialis', 'erector_spinae',
  'forearm_extensors', 'forearm_flexors', 'forearms', 'gastrocnemius', 'gluteus_maximus', 'gluteus_medius',
  'hamstrings', 'hip_flexors', 'infraspinatus_teres_minor', 'lateral_deltoid', 'latissimus_dorsi', 'obliques',
  'pectoralis_major', 'posterior_deltoid', 'quadratus_lumborum', 'quadriceps', 'rectus_abdominis', 'rhomboids',
  'serratus_anterior', 'soleus', 'supraspinatus', 'tibialis_anterior', 'transverse_abdominis', 'trapezius',
  'triceps_brachii',
];

describe('muscle tables', () => {
  it('maps every RepDB muscle name to a free-exercise name and a body slug', () => {
    for (const m of REPDB) {
      expect(REPDB_TO_FX[m], m).toBeTruthy();
      expect(REPDB_TO_SLUG[m], m).toBeTruthy();
    }
  });

  it('maps every free-exercise muscle used for XP to at least one slug', () => {
    for (const m of ['chest', 'middle back', 'lower back', 'lats', 'traps', 'shoulders', 'biceps', 'triceps', 'quadriceps', 'hamstrings', 'glutes', 'calves', 'abdominals'])
      expect(slugsOf([m]).length, m).toBeGreaterThan(0);
  });

  it('maps the openGym targets that dumbbell exercises use', () => {
    for (const t of ['glutes', 'delts', 'abs', 'quads', 'pectorals', 'upper back', 'biceps', 'triceps', 'lats', 'obliques', 'hamstrings', 'calves', 'forearms', 'traps'])
      expect(OG_TARGET_TO_FX[t], t).toBeTruthy();
  });

  it('slugsOf dedupes and keeps order', () => {
    expect(slugsOf(['lats', 'middle back'])).toEqual(['upper-back']);
    expect(slugsOf(['chest', 'triceps', 'chest'])).toEqual(['chest', 'triceps']);
  });

  it('slugsOf ignores names it does not know', () => {
    expect(slugsOf(['neck', 'chest'])).toEqual(['chest']);
  });
});
