// Front and back body figure with the worked muscles lit (UX design §3.1). Geometry: MuscleMap (MIT), ported from
// openGym. It is ~90 KB, so it loads on first use and is shared by every map; until then the figure keeps its size.
import { useEffect, useState } from 'react';
import { BODY_SLUGS, SLUG_LABEL, type BodySlug } from '../../domain/muscle-map';
import { createLoader } from './geometry-loader';

type View = { vb: string; p: Record<string, string[]> };
type Geometry = Record<'male' | 'female', { front: View; back: View }>;

const INERT = ['head', 'hair', 'neck', 'hands', 'feet', 'knees', 'ankles'];

const loadGeometry = createLoader<Geometry>(() => import('./body-paths.js').then((m) => m.default));

function useGeometry(): Geometry | null {
  const [g, setG] = useState(loadGeometry.cached);
  useEffect(() => {
    if (g) return;
    let alive = true;
    // A failure leaves this map blank; the loader forgets it, so the next map that mounts retries.
    loadGeometry()
      .then((v) => alive && setG(v))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [g]);
  return g;
}

type Extra = { fills?: Partial<Record<BodySlug, string>>; selected?: ReadonlySet<string>; onPick?: (slug: BodySlug) => void };

function Figure({ view, primary, secondary, fills, selected, onPick }: { view: View; primary: ReadonlySet<string>; secondary: ReadonlySet<string> } & Extra) {
  return (
    <svg className="ui-body-view" viewBox={view.vb} aria-hidden="true">
      {INERT.map((slug) => (view.p[slug] ?? []).map((d, i) => <path key={slug + i} className="ui-body-sil" d={d} />))}
      {BODY_SLUGS.map((slug) =>
        (view.p[slug] ?? []).map((d, i) => (
          <path
            key={slug + i}
            d={d}
            className={
              (primary.has(slug) ? 'ui-body-m ui-body-m--primary' : secondary.has(slug) ? 'ui-body-m ui-body-m--secondary' : 'ui-body-m') +
              (selected?.has(slug) ? ' ui-body-m--selected' : '') +
              (onPick ? ' ui-body-m--tap' : '')
            }
            style={fills?.[slug] ? { fill: fills[slug] } : undefined}
            onClick={onPick ? () => onPick(slug) : undefined}
          />
        )),
      )}
    </svg>
  );
}

export function BodyMap(props: {
  primary: readonly BodySlug[];
  secondary?: readonly BodySlug[];
  sex?: 'male' | 'female';
  size?: 'sm' | 'md';
  label?: string;
} & Extra) {
  const g = useGeometry();
  const primary = new Set<string>(props.primary);
  const secondary = new Set<string>(props.secondary ?? []);
  const selected = props.selected;
  const label =
    props.label ??
    (props.primary.length > 0 ? `Works ${props.primary.map((s) => SLUG_LABEL[s]).join(', ')}` : 'Body figure, no muscles marked');
  const body = g?.[props.sex ?? 'male'];
  return (
    <div className={`ui-body ui-body--${props.size ?? 'md'}`} role="img" aria-label={label}>
      {body && (
        <>
          <Figure view={body.front} primary={primary} secondary={secondary} fills={props.fills} selected={selected} onPick={props.onPick} />
          <Figure view={body.back} primary={primary} secondary={secondary} fills={props.fills} selected={selected} onPick={props.onPick} />
        </>
      )}
    </div>
  );
}
