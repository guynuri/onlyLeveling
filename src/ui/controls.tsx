// Interactive shared controls (UX design §7): Stepper, SegmentedControl, Sheet, toasts. Styled in ui.css.
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { canStep, stepValue } from './stepper';

export function Stepper(props: {
  value: number;
  onChange: (v: number) => void;
  label: string;
  unit?: string;
  values?: readonly number[];
  step?: number;
  min?: number;
  max?: number;
}) {
  const { value, onChange, label, unit, ...opts } = props;
  const tap = (dir: 1 | -1) => onChange(stepValue(value, dir, opts));
  return (
    <div className="ui-stepper" role="group" aria-label={label}>
      <button type="button" className="ui-stepper-btn" aria-label={`Less ${label}`} disabled={!canStep(value, -1, opts)} onClick={() => tap(-1)}>
        −
      </button>
      <output className="ui-stepper-value" aria-live="polite">
        {value}
        {unit && <span className="ui-stepper-unit"> {unit}</span>}
      </output>
      <button type="button" className="ui-stepper-btn" aria-label={`More ${label}`} disabled={!canStep(value, 1, opts)} onClick={() => tap(1)}>
        +
      </button>
    </div>
  );
}

export function SegmentedControl<T extends string>(props: {
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div className="ui-segmented" role="radiogroup" aria-label={props.label}>
      {props.options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={props.value === o.value}
          className="ui-segment"
          onClick={() => props.onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

// Bottom sheet on a native <dialog>: Escape, the close button and a backdrop tap all close it. The page behind
// does not scroll while it is open.
export function Sheet(props: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const { open, onClose } = props;

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (open && bodyRef.current) bodyRef.current.scrollTop = 0; // a fresh sheet always starts at the top
    if (!open && d.open) d.close();
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  return (
    <dialog
      ref={ref}
      className="ui-sheet"
      aria-label={props.title}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="ui-sheet-body" ref={bodyRef}>
        <header className="ui-sheet-head">
          <h2 className="ui-sheet-title">{props.title}</h2>
          <button type="button" className="ui-sheet-close" aria-label="Close" onClick={onClose}>
            ✕
          </button>
        </header>
        {open && props.children}
      </div>
    </dialog>
  );
}

const TOAST_EVENT = 'ui-toast';

export function toast(message: string): void {
  window.dispatchEvent(new CustomEvent(TOAST_EVENT, { detail: message }));
}

export function ToastHost() {
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => {
    let timer: number | undefined;
    const onToast = (e: Event) => {
      setMsg((e as CustomEvent<string>).detail);
      window.clearTimeout(timer);
      timer = window.setTimeout(() => setMsg(null), 3000);
    };
    window.addEventListener(TOAST_EVENT, onToast);
    return () => {
      window.removeEventListener(TOAST_EVENT, onToast);
      window.clearTimeout(timer);
    };
  }, []);
  return (
    <div className="ui-toast-host" role="status" aria-live="polite">
      {msg && <div className="ui-toast">{msg}</div>}
    </div>
  );
}
