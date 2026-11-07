// Edits to the saved plan, shared by the Plan screen and the workout preview. An edit is shown at once and saved in
// the background, one save after another in order, so quick taps build on each other and none is lost. A failed save
// says so. The clock is read here, outside render.
import { useEffect, useRef, useState } from 'react';
import type { Plan } from '../../domain/plan';
import { getRepo } from './data';

const applyEdit = (cur: Plan, fn: (plan: Plan, now: number) => Plan): Plan => fn(cur, Date.now());

export function usePlanEditor(plan: Plan | null, setPlan: (p: Plan) => void) {
  const latest = useRef<Plan | null>(plan); // the newest plan, including edits still being saved
  const saves = useRef<Promise<unknown>>(Promise.resolve());
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    latest.current = plan;
  }, [plan]);

  const edit = (fn: (plan: Plan, now: number) => Plan) => {
    const cur = latest.current;
    if (!cur) return;
    const next = applyEdit(cur, fn);
    if (next === cur) return;
    latest.current = next;
    setPlan(next);
    setError(null);
    saves.current = saves.current
      .then(async () => (await getRepo()).savePlan(next))
      .catch(() => setError('Could not save your last change. Check it, then try again.'));
  };

  return { edit, error };
}
