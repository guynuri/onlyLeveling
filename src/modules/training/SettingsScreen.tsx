import { useEffect, useState } from 'react';
import { getRepo, defaultSettings } from './data';
import { parseSettingsForm } from './validate';

// Core settings per D5: days, rest, owned dumbbells. Units are kg. Inputs are text until they are checked.
export default function SettingsScreen() {
  const [days, setDays] = useState('');
  const [rest, setRest] = useState('');
  const [owned, setOwned] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [status, setStatus] = useState('');

  useEffect(() => {
    getRepo()
      .then((r) => r.getSettings())
      .then((saved) => {
        const cur = saved ?? defaultSettings();
        setDays(String(cur.daysPerWeek));
        setRest(String(cur.restSec));
        setOwned(cur.owned.join(', '));
        setLoaded(true);
      })
      .catch(() => setStatus('Could not load settings. Reload the page to try again.'));
  }, []);

  if (!loaded) return <p className="muted">{status || 'Loading…'}</p>;

  async function save() {
    const parsed = parseSettingsForm({ days, rest, owned });
    if (!parsed.ok) {
      setStatus(parsed.error);
      return;
    }
    try {
      const repo = await getRepo();
      await repo.saveSettings(parsed.value);
      setOwned(parsed.value.owned.join(', '));
      setStatus('Saved on this device. Last synced: never.');
    } catch {
      setStatus('Could not save. Nothing changed; try again.');
    }
  }

  return (
    <section>
      <h1>Settings</h1>
      <label className="field">
        Days per week (1–7)
        <input inputMode="numeric" value={days} onChange={(e) => setDays(e.target.value)} />
      </label>
      <label className="field">
        Rest between sets (seconds, 0 = off)
        <input inputMode="numeric" value={rest} onChange={(e) => setRest(e.target.value)} />
      </label>
      <label className="field">
        Dumbbells owned, kg (e.g. 4, 6, 8, 10)
        <textarea rows={3} value={owned} onChange={(e) => setOwned(e.target.value)} />
      </label>
      <button type="button" onClick={save}>
        Save
      </button>
      <p className="muted">{status}</p>
      <p>
        <a href="#/credits">Credits</a>
      </p>
    </section>
  );
}
