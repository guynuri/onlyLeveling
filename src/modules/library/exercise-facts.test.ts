import { describe, it, expect } from 'vitest';
import { youtubeSearchUrl, recentSessions, sourceLine } from './exercise-facts';
import type { Workout } from '../../domain/types';
import type { SetRow } from '../../domain/session';
import type { Exercise } from '../../domain/exercise';

const set = (w: number, r: number, done = true, phase: SetRow['phase'] = 'work'): SetRow => ({ w, r, done, phase, at: 0 });
const workout = (start: number, entries: [string, SetRow[]][]): Workout => ({
  id: `w${start}`,
  start,
  end: start + 1,
  entries: entries.map(([exerciseId, sets]) => ({ exerciseId, planned: { w: 0, reps: 8, sets: 3 } as Workout['entries'][number]['planned'], sets })),
});

describe('youtubeSearchUrl', () => {
  it('searches for the exercise name with form keywords, encoded', () => {
    expect(youtubeSearchUrl('Curl & Press')).toBe('https://www.youtube.com/results?search_query=Curl%20%26%20Press%20exercise%20form');
  });
});

describe('recentSessions', () => {
  const ws = [
    workout(100, [['a', [set(10, 8), set(12, 6)]]]),
    workout(300, [['a', [set(12, 8), set(12, 10)]], ['b', [set(5, 5)]]]),
    workout(200, [['b', [set(20, 5)]]]),
    workout(400, [['a', [set(30, 1, false), set(8, 12, true, 'warmup'), set(10, 9)]]]),
  ];

  it('newest first, only sessions with that exercise, best by weight then reps', () => {
    expect(recentSessions(ws, 'a', 5)).toEqual([
      { date: 400, best: { w: 10, r: 9 } },
      { date: 300, best: { w: 12, r: 10 } },
      { date: 100, best: { w: 12, r: 6 } },
    ]);
  });

  it('ignores undone and warm-up sets, and caps the count', () => {
    expect(recentSessions(ws, 'a', 1)).toEqual([{ date: 400, best: { w: 10, r: 9 } }]);
  });

  it('skips a session whose sets for the exercise are all undone', () => {
    expect(recentSessions([workout(1, [['a', [set(10, 5, false)]]])], 'a', 3)).toEqual([]);
  });
});

describe('sourceLine', () => {
  const base = { license: 'x', media: undefined } as unknown as Exercise;
  it('credits RepDB for RepDB records', () => {
    expect(sourceLine({ ...base, source: 'repdb', license: 'RepDB Free Tier License v1.0' })).toBe(
      'Text and pictures: Exercise data by RepDB (repdb.co) · RepDB Free Tier License v1.0',
    );
  });
  it('a plain free-exercise-db record credits only free-exercise-db', () => {
    expect(sourceLine({ ...base, source: 'free-exercise-db', license: 'Unlicense' })).toBe('Text: free-exercise-db · Unlicense');
  });
  it('credits RepDB text on a free-exercise-db record that took RepDB description or tips, even without pictures', () => {
    expect(sourceLine({ ...base, source: 'free-exercise-db', license: 'Unlicense', extrasFrom: 'repdb' })).toBe(
      'Steps: free-exercise-db · Unlicense. Description, tips and pictures: Exercise data by RepDB (repdb.co)',
    );
  });
  it('names openGym and the text licence', () => {
    expect(sourceLine({ ...base, source: 'opengym', license: 'MIT (ExerciseDB text)' })).toBe('Text: openGym catalogue · MIT (ExerciseDB text)');
  });
});
