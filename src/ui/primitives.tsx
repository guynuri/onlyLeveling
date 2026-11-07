// Shared presentational components (UX design §7). Styled in ui.css with tokens only; screens never style these.
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { pct, toggleIn } from './select';

type ButtonProps = {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'md' | 'sm';
  block?: boolean;
  icon?: ReactNode;
} & ButtonHTMLAttributes<HTMLButtonElement>;

export function Button({ variant = 'primary', size = 'md', block, icon, className, children, type, ...rest }: ButtonProps) {
  const cls = ['ui-btn', `ui-btn--${variant}`, `ui-btn--${size}`, block ? 'ui-btn--block' : '', className ?? '']
    .filter(Boolean)
    .join(' ');
  return (
    <button type={type ?? 'button'} className={cls} {...rest}>
      {icon && <span className="ui-btn-icon">{icon}</span>}
      {children}
    </button>
  );
}

export function Card(props: { title?: string; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`ui-card ${props.className ?? ''}`.trim()}>
      {(props.title || props.action) && (
        <header className="ui-card-head">
          {props.title && <h2 className="ui-card-title">{props.title}</h2>}
          {props.action}
        </header>
      )}
      {props.children}
    </section>
  );
}

export type Tone = 'violet' | 'amber' | 'cyan' | 'pink' | 'green' | 'red';
export const toneVar = (t: Tone) => ({ ['--tone-c' as string]: `var(--tone-${t}-c)` });

export function Tile(props: { href: string; icon?: ReactNode; label: string; value?: ReactNode; badge?: number; tone?: Tone }) {
  return (
    <a className="ui-tile" href={props.href}>
      {props.icon && (
        <span className="ui-tile-icon" style={props.tone ? toneVar(props.tone) : undefined}>
          {props.icon}
        </span>
      )}
      <span className="ui-tile-text">
        <span className="ui-tile-label">{props.label}</span>
        {props.value !== undefined && <span className="ui-tile-value">{props.value}</span>}
      </span>
      {props.badge !== undefined && props.badge > 0 && (
        <span className="ui-badge" aria-label={`${props.badge} new`}>
          {props.badge}
        </span>
      )}
    </a>
  );
}

export function Chip(props: { selected: boolean; onToggle: () => void; children: ReactNode }) {
  return (
    <button type="button" className="ui-chip" aria-pressed={props.selected} onClick={props.onToggle}>
      {props.children}
    </button>
  );
}

export function ChipGroup<T extends string | number>(props: {
  options: readonly { value: T; label: string }[];
  value: readonly T[];
  onChange: (next: T[]) => void;
  label: string;
}) {
  return (
    <div className="ui-chips" role="group" aria-label={props.label}>
      {props.options.map((o) => (
        <Chip key={String(o.value)} selected={props.value.includes(o.value)} onToggle={() => props.onChange(toggleIn(props.value, o.value))}>
          {o.label}
        </Chip>
      ))}
    </div>
  );
}

export function ChoiceCard(props: { selected: boolean; onSelect: () => void; title: string; sub?: string; icon?: ReactNode }) {
  return (
    <button type="button" className="ui-choice" aria-pressed={props.selected} onClick={props.onSelect}>
      {props.icon && <span className="ui-choice-icon">{props.icon}</span>}
      <span className="ui-choice-text">
        <span className="ui-choice-title">{props.title}</span>
        {props.sub && <span className="ui-choice-sub">{props.sub}</span>}
      </span>
    </button>
  );
}

export function ProgressBar(props: { value: number; max: number; label?: string }) {
  const p = pct(props.value, props.max);
  return (
    <div
      className="ui-progress"
      role="progressbar"
      aria-label={props.label}
      aria-valuemin={0}
      aria-valuemax={props.max}
      aria-valuenow={props.value}
    >
      <div className="ui-progress-fill" style={{ width: `${p}%` }} />
    </div>
  );
}

const GLOWING = new Set(['S', 'SS', 'SSS']);

export function RankBadge(props: { rank: string }) {
  return (
    <span
      className={`ui-rank${GLOWING.has(props.rank) ? ' ui-rank--glow' : ''}`}
      style={{ ['--rank' as string]: `var(--rank-${props.rank})` }}
      aria-label={`Rank ${props.rank}`}
    >
      {props.rank}
    </span>
  );
}

export function EmptyState(props: { icon?: ReactNode; title: string; body?: string; action?: ReactNode }) {
  return (
    <div className="ui-empty">
      {props.icon && <span className="ui-empty-icon">{props.icon}</span>}
      <p className="ui-empty-title">{props.title}</p>
      {props.body && <p className="ui-empty-body">{props.body}</p>}
      {props.action}
    </div>
  );
}
