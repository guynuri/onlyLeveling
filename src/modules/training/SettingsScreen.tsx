import { useEffect, useState } from 'react';
import { getRepo, defaultSettings } from './data';
import type { Settings } from '../../domain/types';

// Core settings per D5: days, rest, owned dumbbells. Units are kg.
export default function SettingsScreen() {
  const [s, setS] = useState<Settings | null>(null);
  const [ownedText, setOwnedText] = useState('');
  const [status, setStatus] = useState('');

  useEffect(() => {
    getRepo().then((r) => r.getSettings()).then((saved) => {
      const cur = saved ?? defaultSettings();
      setS(cur);
      setOwnedText(cur.owned.join(', '));
    });
  }, []);

  if (!s) return <p className="muted">Loading…</p>;

  async function save() {
    if (!s) return;
    const owned = ownedText
      .split(/[,\s]+/)
      .map((x) => Number(x))
      .filter((x) => Number.isFinite(x) && x > 0);
    if (owned.length === 0) {
      setStatus('Enter at least one dumbbell weight.');
      return;
    }
    const next: Settings = { ...s, owned: [...new Set(owned)].sort((a, b) => a - b) };
    const repo = await getRepo();
    await repo.saveSettings(next);
    setS(next);
    setOwnedText(next.owned.join(', '));
    setStatus('Saved. Last synced: never (local only until Phase 4).');
  }

  return (
    <section>
      <h1>Settings</h1>
      <label className="field">
        Days per week
        <input
          type="number"
          min={1}
          max={7}
          value={s.daysPerWeek}
          onChange={(e) => setS({ ...s, daysPerWeek: Number(e.target.value) })}
        />
      </label>
      <label className="field">
        Rest between sets (seconds, 0 = off)
        <input
          type="number"
          min={0}
          value={s.restSec}
          onChange={(e) => setS({ ...s, restSec: Math.max(0, Number(e.target.value)) })}
        />
      </label>
      <label className="field">
        Dumbbells owned, kg (one pair per weight; e.g. 4, 6, 8, 10)
        <textarea rows={3} value={ownedText} onChange={(e) => setOwnedText(e.target.value)} />
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
