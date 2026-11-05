import { CREDITS } from '../../data/credits';

export default function CreditsScreen() {
  return (
    <section>
      <a href="#/settings">← Settings</a>
      <h1>Credits</h1>
      {CREDITS.map((c) => (
        <div key={c.name} className="credit">
          <h2>
            <a href={c.url}>{c.name}</a>
          </h2>
          <p>Licence: {c.licence}</p>
          <p className="muted">{c.uses}</p>
        </div>
      ))}
    </section>
  );
}
