import { useEffect, useState } from 'react';
import { getRepo, getLocalRepo, defaultSettings } from './data';
import { parseSettingsForm } from './validate';
import {
  readSyncState,
  runSync,
  signInWithPassword,
  createAccountWithInvite,
  recoverAccount,
  signOut,
  createInvite,
  syncLabel,
} from '../sync/actions';
import { fetchExport, type SyncState } from '../../data/sync-engine';
import { PushSettings } from '../push/ui/PushSettings';
import { AuthClientError } from '../../data/auth-client';

const DEFAULT_SERVER = 'https://onlyleveling-api.guynuri.workers.dev';
type Mode = 'signin' | 'signup' | 'recover';

function messageOf(e: unknown): string {
  if (e instanceof AuthClientError) return e.message;
  return e instanceof Error ? e.message : 'Something went wrong. Try again.';
}

// Core settings per D5 (days, rest, owned dumbbells), plus the account, sync and export (SPEC §6.3).
export default function SettingsScreen() {
  const [days, setDays] = useState('');
  const [rest, setRest] = useState('');
  const [owned, setOwned] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [status, setStatus] = useState('');
  const [sync, setSync] = useState<SyncState | null>(null);

  const [server, setServer] = useState(DEFAULT_SERVER);
  const [mode, setMode] = useState<Mode>('signin');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [newInvite, setNewInvite] = useState<string | null>(null);

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

  // Sign-in, sign-up and recovery all end the same way: the session is stored, then the device syncs.
  async function account() {
    setStatus('Working…');
    try {
      let after: SyncState;
      if (mode === 'signin') {
        after = await signInWithPassword(server, username.trim(), password);
      } else if (mode === 'signup') {
        after = await createAccountWithInvite(server, { code: code.trim(), username: username.trim(), password });
      } else {
        after = await recoverAccount(server, { username: username.trim(), code: code.trim(), newPassword: password });
      }
      setSync(after);
      setPassword('');
      setCode('');
      setStatus(after.lastError ? `Signed in, but sync failed: ${after.lastError}` : 'Signed in and synced.');
    } catch (e) {
      setStatus(messageOf(e));
    }
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
    setNewInvite(null);
    setStatus('Signed out on this device. Local data is kept.');
  }

  async function makeInvite() {
    try {
      setNewInvite(await createInvite());
      setStatus('Invite code created. Give it to one person; it works once.');
    } catch (e) {
      setStatus(messageOf(e));
    }
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
      setStatus(`Export failed: ${messageOf(e)}`);
    }
  }

  const signedIn = !!sync?.config;

  return (
    <section>
      <h1>Settings</h1>
      <PushSettings />
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

      {signedIn ? (
        <>
          <div className="row">
            <button type="button" onClick={syncNowClick}>
              Sync now
            </button>
            <button type="button" onClick={exportData}>
              Export my data
            </button>
            <button type="button" onClick={makeInvite}>
              Create invite code
            </button>
            <button type="button" onClick={disconnect}>
              Sign out here
            </button>
          </div>
          {newInvite && (
            <p>
              Invite code: <strong className="code">{newInvite}</strong>
            </p>
          )}
        </>
      ) : (
        <>
          <div className="row">
            <button type="button" className={mode === 'signin' ? '' : 'ghost'} onClick={() => setMode('signin')}>
              Sign in
            </button>
            <button type="button" className={mode === 'signup' ? '' : 'ghost'} onClick={() => setMode('signup')}>
              Create account
            </button>
            <button type="button" className={mode === 'recover' ? '' : 'ghost'} onClick={() => setMode('recover')}>
              Forgot password
            </button>
          </div>
          <label className="field">
            Server address
            <input value={server} onChange={(e) => setServer(e.target.value)} autoCapitalize="none" />
          </label>
          <label className="field">
            Username
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoCapitalize="none"
              autoComplete="username"
            />
          </label>
          {mode !== 'signin' && (
            <label className="field">
              Invite code{mode === 'recover' ? ' (one you created)' : ''}
              <input value={code} onChange={(e) => setCode(e.target.value)} autoCapitalize="characters" />
            </label>
          )}
          <label className="field">
            {mode === 'recover' ? 'New password (at least 10 characters)' : 'Password (at least 10 characters)'}
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
            />
          </label>
          <button type="button" onClick={account}>
            {mode === 'signin' ? 'Sign in and sync' : mode === 'signup' ? 'Create account' : 'Reset password'}
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
