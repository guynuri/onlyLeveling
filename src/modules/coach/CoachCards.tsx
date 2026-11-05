// Coach cards on the Today screen (SPEC §4). Plain words only: no e1RM, RIR, stall, deload or stale in the copy.
import { useEffect, useState } from 'react';
import { getExercise } from '../../data/exercises';
import type { Suggestion, SuggestionAction } from '../../domain/suggestion';
import { loadCoachCards, acceptCoachCard, snoozeCoachCard, neverCoachCard } from './actions';

export const COACH_FOOTER = 'Suggestion. Training guidance, not medical advice.';

const kg = (v: number) => `${Math.round(v * 10) / 10} kg`;

export function actionLabel(a: SuggestionAction, exerciseName: (id: string) => string): string {
  if (a.kind === 'swap') return `Swap for ${exerciseName(a.toId)}`;
  if (a.kind === 'jump') return `Next time: ${kg(a.w)}`;
  return `Next time: a lighter ${kg(a.w)}`;
}

export function CoachCards() {
  const [cards, setCards] = useState<Suggestion[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = () =>
    loadCoachCards()
      .then((c) => setCards(c))
      .catch(() => setError('Could not load suggestions. Reload to try again.'));

  useEffect(() => {
    loadCoachCards()
      .then((c) => setCards(c))
      .catch(() => setError('Could not load suggestions. Reload to try again.'));
  }, []);

  const act = (fn: () => Promise<void>) => {
    setError(null);
    fn().then(reload).catch(() => setError('Could not save that. Try again.'));
  };

  if (error) return <p className="muted">{error}</p>;
  if (!cards) return null;

  const name = (id: string) => getExercise(id)?.name ?? id;

  return (
    <section aria-label="Suggestions">
      {cards.length === 0 && (
        <p className="muted">No suggestions. They appear after a few weeks of sessions.</p>
      )}
      {cards.map((c) => (
        <article key={c.id} className="coach-card">
          <h2>{name(c.exerciseId)}</h2>
          <p>{c.reason}</p>
          <p>
            <strong>{actionLabel(c.action, name)}</strong>
          </p>
          <div className="coach-actions">
            <button type="button" onClick={() => act(() => acceptCoachCard(c))}>
              Accept
            </button>
            <button type="button" onClick={() => act(() => snoozeCoachCard(c))}>
              Not now
            </button>
            <button type="button" onClick={() => act(() => neverCoachCard(c))}>
              Never
            </button>
          </div>
          <p className="muted small">{COACH_FOOTER}</p>
        </article>
      ))}
    </section>
  );
}
