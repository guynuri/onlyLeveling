// The weekly review card on Today (PLAN, SPEC Phase 2). Shows last week's review once. Dismissing it is remembered on
// this device for that week only; if the browser cannot store it, the card simply comes back next time.
import { useEffect, useState } from 'react';
import { loadWeeklyReview, type ReviewView } from '../actions';

const dismissKey = (week: string) => `weekly-review-dismissed:${week}`;

function wasDismissed(week: string): boolean {
  try {
    return localStorage.getItem(dismissKey(week)) === '1';
  } catch {
    return false;
  }
}

function rememberDismissed(week: string): void {
  try {
    localStorage.setItem(dismissKey(week), '1');
  } catch {
    // Storage is unavailable: nothing to remember.
  }
}

export function WeeklyReview() {
  const [view, setView] = useState<ReviewView | null>(null);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    loadWeeklyReview()
      .then((v) => {
        setView(v);
        setHidden(v !== null && wasDismissed(v.week));
      })
      .catch(() => setView(null));
  }, []);

  if (!view || hidden) return null;

  return (
    <section className="weekly-review" aria-label="Last week">
      <h2>Last week</h2>
      <p>{view.text}</p>
      {view.label === 'rules' && <p className="muted small">Built by rules; AI unavailable.</p>}
      <p className="muted small">Training guidance, not medical advice.</p>
      <button
        type="button"
        onClick={() => {
          rememberDismissed(view.week);
          setHidden(true);
        }}
      >
        Dismiss
      </button>
    </section>
  );
}
