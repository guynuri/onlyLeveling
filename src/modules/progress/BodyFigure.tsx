// Front-view figure drawn here, not copied from anywhere (CLAUDE.md: no third-party artwork). Each tappable region
// fills in as its muscle's XP grows toward the B rank, so the figure shows progress over time. The muscle list next
// to it is the full control; the figure is a shortcut.
import type { Group } from '../xp/domain/muscles';

interface Region {
  group: Group;
  d: string; // SVG path
  label: string;
}

// Coordinates in a 120 × 240 box.
const REGIONS: Region[] = [
  { group: 'shoulders', d: 'M30 46 a10 10 0 1 0 0.1 0 Z M80 46 a10 10 0 1 0 0.1 0 Z', label: 'shoulders' },
  { group: 'chest', d: 'M42 58 H78 V80 H42 Z', label: 'chest' },
  { group: 'core', d: 'M44 84 H76 V112 H44 Z', label: 'core' },
  { group: 'biceps', d: 'M20 62 H30 V100 H20 Z M90 62 H100 V100 H90 Z', label: 'arms' },
  { group: 'quads', d: 'M44 118 H58 V172 H44 Z M62 118 H76 V172 H62 Z', label: 'thighs' },
  { group: 'calves', d: 'M44 180 H58 V226 H44 Z M62 180 H76 V226 H62 Z', label: 'calves' },
];

// The outline (not tappable): head, torso, arms, legs.
const OUTLINE =
  'M60 6 a14 14 0 1 0 0.1 0 Z M40 40 H80 L92 56 V110 L80 116 V176 L84 232 H70 L62 180 H58 L50 232 H36 L40 176 V116 L28 110 V56 Z';

export function BodyFigure(props: {
  xpFor: (g: Group) => number;
  rankFor: (g: Group) => string;
  fullXp: number; // XP that fills a region completely (the B threshold)
  selected: Group;
  onPick: (g: Group) => void;
}) {
  return (
    <svg viewBox="0 0 120 240" width="160" height="320" role="img" aria-label="Body figure, tap a muscle">
      <path d={OUTLINE} fill="none" stroke="currentColor" strokeWidth="1.5" opacity="0.5" />
      {REGIONS.map((r) => {
        const fill = Math.min(1, props.xpFor(r.group) / props.fullXp);
        const isSel = props.selected === r.group;
        return (
          <path
            key={r.group + r.d}
            d={r.d}
            fill="var(--accent, #3b82f6)"
            fillOpacity={0.15 + 0.85 * fill}
            stroke={isSel ? 'currentColor' : 'none'}
            strokeWidth="2"
            style={{ cursor: 'pointer' }}
            role="button"
            tabIndex={0}
            onClick={() => props.onPick(r.group)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                props.onPick(r.group);
              }
            }}
            aria-label={`${r.label}, rank ${props.rankFor(r.group)}`}
            aria-pressed={isSel}
          />
        );
      })}
    </svg>
  );
}
