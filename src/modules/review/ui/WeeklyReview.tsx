// The weekly review card on Today (PLAN, SPEC Phase 2). Shown once per week: the week it was last shown is kept on this
// device. Dismissing it counts as shown. If the browser cannot store that, the card shows again next time.
import { useEffect, useState } from 'react';
import { loadWeeklyReview, type ReviewView } from '../actions';
import { showReviewCard } from '../domain/review';

const LAST_SHOWN_KEY = 'weekly-review-last-shown';

function readLastShown(): string | null {
  try {
    return localStorage.getItem(LAST_SHOWN_KEY);
  } catch {
    return null;
  }
}

function writeLastShown(week: string): void {
  try {
    localStorage.setItem(LAST_SHOWN_KEY, week);
  } catch {
    // Storage is unavailable: the card may show again on a later open.
  }
}

export function WeeklyReview() {
  const [view, setView] = useState<ReviewView | null>(null);

  useEffect(() => {
    loadWeeklyReview()
      .then((v) => {
        if (!v || !showReviewCard(readLastShown(), v.week)) return;
        writeLastShown(v.week); // the first open of the week is the one that shows it
        setView(v);
      })
      .catch(() => setView(null));
  }, []);

  if (!view) return null;

  return (
    <section className="weekly-review" aria-label="Last week">
      <h2>Last week</h2>
      <p>{view.text}</p>
      {view.label === 'rules' && <p className="muted small">Built by rules; AI unavailable.</p>}
      <p className="muted small">Training guidance, not medical advice.</p>
      <button type="button" onClick={() => setView(null)}>
        Dismiss
      </button>
    </section>
  );
}
