// Front and back body figure with the worked muscles lit (UX design §3.1). Geometry: MuscleMap (MIT), ported from
// openGym. It is ~90 KB, so it loads on first use and is shared by every map; until then the figure keeps its size.
import { useEffect, useState } from 'react';
import { BODY_SLUGS, SLUG_LABEL, type BodySlug } from '../../domain/muscle-map';

type View = { vb: string; p: Record<string, string[]> };
type Geometry = Record<'male' | 'female', { front: View; back: View }>;

const INERT = ['head', 'hair', 'neck', 'hands', 'feet', 'knees', 'ankles'];

let cache: Geometry | null = null;
let pending: Promise<Geometry> | null = null;

function useGeometry(): Geometry | null {
  const [g, setG] = useState(cache);
  useEffect(() => {
    if (cache) return;
    let alive = true;
    pending ??= import('./body-paths.js').then((m) => (cache = m.default));
    pending.then((v) => alive && setG(v)).catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);
  return g;
}

function Figure({ view, primary, secondary }: { view: View; primary: ReadonlySet<string>; secondary: ReadonlySet<string> }) {
  return (
    <svg className="ui-body-view" viewBox={view.vb} aria-hidden="true">
      {INERT.map((slug) => (view.p[slug] ?? []).map((d, i) => <path key={slug + i} className="ui-body-sil" d={d} />))}
      {BODY_SLUGS.map((slug) =>
        (view.p[slug] ?? []).map((d, i) => (
          <path
            key={slug + i}
            d={d}
            className={primary.has(slug) ? 'ui-body-m ui-body-m--primary' : secondary.has(slug) ? 'ui-body-m ui-body-m--secondary' : 'ui-body-m'}
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
}) {
  const g = useGeometry();
  const primary = new Set<string>(props.primary);
  const secondary = new Set<string>(props.secondary ?? []);
  const label =
    props.primary.length > 0 ? `Works ${props.primary.map((s) => SLUG_LABEL[s]).join(', ')}` : 'Body figure, no muscles marked';
  const body = g?.[props.sex ?? 'male'];
  return (
    <div className={`ui-body ui-body--${props.size ?? 'md'}`} role="img" aria-label={label}>
      {body && (
        <>
          <Figure view={body.front} primary={primary} secondary={secondary} />
          <Figure view={body.back} primary={primary} secondary={secondary} />
        </>
      )}
    </div>
  );
}
