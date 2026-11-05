import { useEffect, useState } from 'react';
import { getRepo, getLocalRepo, defaultSettings } from './data';
import { parseSettingsForm } from './validate';
import { readSyncState, runSync, signIn, signOut, syncLabel } from '../sync/actions';
import { fetchExport, type SyncState } from '../../data/sync-engine';

const DEFAULT_SERVER = 'https://onlyleveling-api.guynuri.workers.dev';

// Core settings per D5 (days, rest, owned dumbbells), plus the server connection and the export (SPEC §6.3).
export default function SettingsScreen() {
  const [days, setDays] = useState('');
  const [rest, setRest] = useState('');
  const [owned, setOwned] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [status, setStatus] = useState('');
  const [sync, setSync] = useState<SyncState | null>(null);
  const [server, setServer] = useState(DEFAULT_SERVER);
  const [token, setToken] = useState('');

  useEffect(() => {
    Promise.all([getLocalRepo().then((r) => r.getSettings()), readSyncState()])
      .then(([saved, st]) => {
        const cur = saved ?? defaultSettings();
        setDays(String(cur.daysPerWeek));
        setRest(String(cur.restSec));
        setOwned(cur.owned.join(', '));
        setSync(st);
        if (st.config) setServer(st.config.baseUrl);
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
      const repo = await getRepo(); // queued for the server as well
      await repo.saveSettings(parsed.value);
      setOwned(parsed.value.owned.join(', '));
      setStatus('Saved on this device.');
    } catch {
      setStatus('Could not save. Nothing changed; try again.');
    }
  }

  async function connect() {
    if (!server.trim() || !token.trim()) {
      setStatus('Enter the server address and the token.');
      return;
    }
    setStatus('Connecting…');
    const after = await signIn(server.trim(), token.trim());
    setSync(after);
    setToken('');
    setStatus(after.lastError ? `Could not connect: ${after.lastError}` : 'Connected and synced.');
  }

  async function syncNowClick() {
    setStatus('Syncing…');
    const after = await runSync();
    setSync(after);
    setStatus(after.lastError ? `Sync failed: ${after.lastError}` : 'Synced.');
  }

  async function disconnect() {
    await signOut();
    setSync(await readSyncState());
    setStatus('Signed out on this device. Local data is kept.');
  }

  async function exportData() {
    const st = await readSyncState();
    if (!st.config) {
      setStatus('Sign in to a server first, to export the account.');
      return;
    }
    try {
      const data = await fetchExport(st.config);
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `onlyleveling-export-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setStatus('Export downloaded.');
    } catch (e) {
      setStatus(`Export failed: ${e instanceof Error ? e.message : 'unknown error'}`);
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

      <h2>Account and sync</h2>
      {sync && <p className="muted">{syncLabel(sync)}</p>}
      {sync?.config ? (
        <div className="row">
          <button type="button" onClick={syncNowClick}>
            Sync now
          </button>
          <button type="button" onClick={exportData}>
            Export my data
          </button>
          <button type="button" onClick={disconnect}>
            Sign out here
          </button>
        </div>
      ) : (
        <>
          <label className="field">
            Server address
            <input value={server} onChange={(e) => setServer(e.target.value)} autoCapitalize="none" />
          </label>
          <label className="field">
            Token
            <input type="password" value={token} onChange={(e) => setToken(e.target.value)} autoComplete="off" />
          </label>
          <button type="button" onClick={connect}>
            Connect and sync
          </button>
        </>
      )}

      <p className="muted">{status}</p>
      <p>
        <a href="#/credits">Credits</a>
      </p>
    </section>
  );
}
