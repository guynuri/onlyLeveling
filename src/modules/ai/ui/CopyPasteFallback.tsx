// Manual fallback (SPEC §5.6, CLAUDE.md): copy the prompt to any AI chat, paste the answer back. The answer goes
// through the same validator as the Worker's answer. Nothing is trusted because it was pasted.
import { useState } from 'react';
import { validateAiPlan, type Correction, type ValidPlan } from '../../../../shared/ai-plan';
import { buildPrompt, type PlanRequest } from '../../../../shared/ai-prompt';

export function CopyPasteFallback(props: {
  request: PlanRequest;
  onValid: (plan: ValidPlan, corrections: Correction[]) => void;
}) {
  const [text, setText] = useState('');
  const [errors, setErrors] = useState<string[]>([]);
  const prompt = buildPrompt(props.request);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(prompt);
    } catch {
      setErrors(['Copy did not work here. Select the text in the box below and copy it by hand.']);
    }
  };

  const check = () => {
    const r = validateAiPlan(text, props.request);
    if (r.ok) {
      setErrors([]);
      props.onValid(r.plan, r.corrections);
    } else {
      setErrors(r.errors);
    }
  };

  return (
    <details className="copy-paste">
      <summary>Use another AI (copy and paste)</summary>
      <p className="muted small">Copy the prompt into any AI chat, then paste its answer here. Answers are checked the same way.</p>
      <button type="button" onClick={copy}>
        Copy prompt
      </button>
      <textarea readOnly value={prompt} rows={6} aria-label="Prompt" />
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={8}
        placeholder="Paste the answer here"
        aria-label="Pasted answer"
      />
      <button type="button" onClick={check} disabled={text.trim().length === 0}>
        Check answer
      </button>
      {errors.length > 0 && (
        <ul className="error">
          {errors.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      )}
    </details>
  );
}
