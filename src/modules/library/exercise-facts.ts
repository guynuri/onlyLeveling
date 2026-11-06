// Pure helpers behind the exercise sheet (UX design §6.3). Tested.
import type { Exercise } from '../../domain/exercise';
import type { Workout } from '../../domain/types';

export const REPDB_CREDIT = 'Exercise data by RepDB (repdb.co)';

// A search, not an embed: no third-party player inside the app, and any video the user picks is YouTube's.
export function youtubeSearchUrl(name: string): string {
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(`${name} exercise form`)}`;
}

// The last n sessions with this exercise, newest first, each with its best done working set (weight, then reps).
export function recentSessions(
  workouts: readonly Workout[],
  id: string,
  n: number,
): { date: number; best: { w: number; r: number } }[] {
  const out: { date: number; best: { w: number; r: number } }[] = [];
  for (const w of [...workouts].sort((a, b) => b.start - a.start)) {
    const sets = w.entries
      .filter((e) => e.exerciseId === id)
      .flatMap((e) => e.sets)
      .filter((s) => s.done && s.phase === 'work');
    if (sets.length === 0) continue;
    const best = sets.reduce((a, b) => (b.w > a.w || (b.w === a.w && b.r > a.r) ? b : a));
    out.push({ date: w.start, best: { w: best.w, r: best.r } });
    if (out.length === n) break;
  }
  return out;
}

const TEXT_SOURCE: Record<Exercise['source'], string> = {
  'free-exercise-db': 'free-exercise-db',
  repdb: REPDB_CREDIT,
  opengym: 'openGym catalogue',
};

// Where the text and pictures come from, with the licence (CLAUDE.md: every exercise shows its source).
export function sourceLine(ex: Pick<Exercise, 'source' | 'license' | 'media'>): string {
  if (ex.source === 'repdb') return `Text and pictures: ${REPDB_CREDIT} · ${ex.license}`;
  const text = `Text: ${TEXT_SOURCE[ex.source]} · ${ex.license}`;
  return ex.media ? `${text}. Pictures: ${REPDB_CREDIT}` : text;
}
