import { CREDITS } from '../../data/credits';
import { Card } from '../../ui/primitives';

export default function CreditsScreen() {
  return (
    <section>
      <a href="#/more">← More</a>
      <h1>Credits</h1>
      {CREDITS.map((c) => (
        <Card key={c.name}>
          <h2 className="ui-card-title">
            <a href={c.url}>{c.name}</a>
          </h2>
          <p className="small">Licence: {c.licence}</p>
          <p className="muted small">{c.uses}</p>
        </Card>
      ))}
    </section>
  );
}
