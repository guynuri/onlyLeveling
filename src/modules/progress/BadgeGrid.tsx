// Badges as medals: earned ones in colour with a glow, locked ones greyed with how to earn them.
import type { CSSProperties, ReactNode } from 'react';
import { Dumbbell, Lock, Medal, TrendingUp, Zap } from 'lucide-react';
import { badgeCatalogue, type BadgeView } from '../xp/domain/badges';
import { Card } from '../../ui/primitives';

const ICON: Record<BadgeView['kind'], ReactNode> = {
  session: <Dumbbell />,
  pr: <Zap />,
  rankup: <TrendingUp />,
  muscle: <Medal />,
};
const TONE: Record<Exclude<BadgeView['kind'], 'muscle'>, string> = {
  session: 'var(--tone-violet)',
  pr: 'var(--tone-amber)',
  rankup: 'var(--tone-pink)',
};

function bg(b: BadgeView): string {
  return b.kind === 'muscle' ? `radial-gradient(circle at 30% 25%, #fff8, var(--rank-${b.rank}) 55%)` : TONE[b.kind];
}

export function BadgeGrid({ earned }: { earned: readonly string[] }) {
  const all = badgeCatalogue(earned);
  const count = all.filter((b) => b.earned).length;
  return (
    <Card title="Badges" action={<span className="muted small">{count} of {all.length}</span>}>
      <ul className="badge-grid">
        {all.map((b) => (
          <li key={b.key} className={b.earned ? 'badge badge--earned' : 'badge'} aria-label={b.earned ? `${b.label}, earned` : `${b.label}, locked: ${b.hint}`}>
            <span className="badge-medal" style={{ ['--medal' as string]: bg(b) } as CSSProperties} aria-hidden="true">
              {ICON[b.kind]}
              {b.kind === 'muscle' && <span className="badge-rank">{b.rank}</span>}
              {!b.earned && (
                <span className="badge-lock">
                  <Lock />
                </span>
              )}
            </span>
            <span className="badge-label">{b.label}</span>
            {!b.earned && <span className="badge-hint">{b.hint}</span>}
          </li>
        ))}
      </ul>
    </Card>
  );
}
