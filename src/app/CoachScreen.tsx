// Coach (owner report 2026-11-07): suggestions and the weekly review on their own screen, so they can be read and
// accepted without starting today's workout. Train still shows them above the session.
import { CoachCards } from '../modules/coach/CoachCards';
import { WeeklyReview } from '../modules/review/ui/WeeklyReview';

export default function CoachScreen() {
  return (
    <section className="ui-stack">
      <h1>Coach</h1>
      <WeeklyReview always />
      <CoachCards />
    </section>
  );
}
