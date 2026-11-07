// What the screen shows while the AI writes a plan (owner request 2026-11-07): an indeterminate bar and the steps
// the request goes through. The steps advance on a timer: they describe the work, they do not measure it.
import { useEffect, useState } from 'react';
import { Sparkles } from 'lucide-react';

const STEPS = ['Reading your answers', 'Picking exercises for your equipment', 'Balancing your week', 'Checking it against the rules'];
const STEP_MS = 4_000;

export function AiThinking() {
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI((n) => Math.min(n + 1, STEPS.length - 1)), STEP_MS);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="ai-thinking" role="status" aria-live="polite">
      <div className="ai-thinking-card">
        <span className="ai-thinking-icon" aria-hidden="true">
          <Sparkles />
        </span>
        <p className="ai-thinking-title">Building your plan</p>
        <div className="ai-thinking-bar" aria-hidden="true">
          <span />
        </div>
        <ol className="ai-thinking-steps">
          {STEPS.map((s, k) => (
            <li key={s} className={k < i ? 'done' : k === i ? 'now' : undefined}>
              {k < i ? '✓ ' : ''}
              {s}
            </li>
          ))}
        </ol>
        <p className="muted small">This can take up to a minute.</p>
      </div>
    </div>
  );
}
