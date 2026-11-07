import { useEffect, useState } from 'react';
import { getRepo, getLocalRepo, defaultSettings } from './data';
import { saveProfilePatch } from './validate';
import type { Settings } from '../../domain/types';
import { workoutViewOf } from '../../domain/profile';
import { Button, Card, Chip } from '../../ui/primitives';
import { SegmentedControl, Stepper, toast } from '../../ui/controls';
import { applyTheme, readTheme, type ThemeChoice } from '../../ui/theme';
import { setSoundOn, soundOn } from '../../ui/sound';
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
import { DIFFICULTY_LOCK } from '../../config/thresholds';

const DEFAULT_SERVER = 'https://onlyleveling-api.guynuri.workers.dev';
type Mode = 'signin' | 'signup' | 'recover';

const MODES = [
  { value: 'signin', label: 'Sign in' },
  { value: 'signup', label: 'New account' },
  { value: 'recover', label: 'Forgot' },
] as const;

const THEMES = [
  { value: 'system', label: 'Phone' },
  { value: 'dark', label: 'Dark' },
  { value: 'light', label: 'Light' },
] as const;

function messageOf(e: unknown): string {
  if (e instanceof AuthClientError) return e.message;
  return e instanceof Error ? e.message : 'Something went wrong. Try again.';
}

// Core settings per D5 (days, rest, owned dumbbells), plus the account, sync and export (SPEC §6.3).
export default function SettingsScreen() {
  const [current, setCurrent] = useState<Settings | null>(null);
  const [days, setDays] = useState(3);
  const [rest, setRest] = useState(90);
  const [view, setView] = useState<'focus' | 'list'>('focus');
  const [lock, setLock] = useState(false);
  const [theme, setTheme] = useState<ThemeChoice>(readTheme);
  const [sound, setSound] = useState(soundOn);
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
        setCurrent(cur);
        setDays(cur.daysPerWeek);
        setRest(cur.restSec);
        setView(workoutViewOf(cur));
        setLock(!!cur.lockByRank);
        setSync(st);
        if (st.config) setServer(st.config.baseUrl);
        setLoaded(true);
      })
      .catch(() => setStatus('Could not load settings. Reload the page to try again.'));
  }, []);

  if (!loaded || !current) return <p className="muted">{status || 'Loading…'}</p>;

  // Days and rest only; the steppers keep both in range. Weights live in the Equipment card.
  async function save() {
    try {
      const repo = await getRepo(); // queued for the server as well
      setCurrent(await saveProfilePatch(repo, { daysPerWeek: days, restSec: rest, workoutView: view, lockByRank: lock }));
      setStatus('');
      toast('Saved on this device.');
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

      <Card title="Training">
        <div className="ui-setting">
          <span>Days per week</span>
          <Stepper label="days per week" value={days} onChange={setDays} min={1} max={7} />
        </div>
        <div className="ui-setting">
          <span>Rest between sets</span>
          <Stepper label="rest seconds" value={rest} onChange={setRest} unit="s" step={15} min={0} />
        </div>
        <p className="muted small">Rest 0 turns the timer off.</p>
        <div className="ui-setting">
          <span>Workout view</span>
          <SegmentedControl
            label="Workout view"
            options={[
              { value: 'focus', label: 'Focus' },
              { value: 'list', label: 'List' },
            ]}
            value={view}
            onChange={setView}
          />
        </div>
        <p className="muted small">Focus shows one exercise at a time. List shows the whole session.</p>
        <h3>Harder exercises</h3>
        <Chip selected={lock} onToggle={() => setLock(!lock)}>
          Unlock with muscle ranks
        </Chip>
        <p className="muted small">
          When on, intermediate exercises open at rank {DIFFICULTY_LOCK.intermediate} of the muscles they train and expert ones at rank{' '}
          {DIFFICULTY_LOCK.expert}. Plans, swaps and the AI only use open ones. Your current plan stays as it is: a new plan applies the lock.
        </p>
        <Button onClick={save}>Save</Button>
      </Card>

      <Card title="Your answers">
        <p className="muted small">Goals, focus muscles, about you, experience, days, session length, equipment, weights and limits.</p>
        <a className="ui-btn ui-btn--secondary ui-btn--md ui-btn--block" href="#/onboarding">
          Take the questionnaire again
        </a>
      </Card>

      <Card title="Appearance">
        <SegmentedControl
          label="Theme"
          options={THEMES}
          value={theme}
          onChange={(t) => {
            setTheme(t);
            applyTheme(t);
          }}
        />
        <SegmentedControl
          label="Sounds"
          options={[
            { value: 'on', label: 'Sounds on' },
            { value: 'off', label: 'Sounds off' },
          ]}
          value={sound ? 'on' : 'off'}
          onChange={(v) => {
            setSound(v === 'on');
            setSoundOn(v === 'on');
          }}
        />
        <p className="muted small">On iPhone the silent switch mutes these sounds.</p>
      </Card>

      <PushSettings />

      <Card title="Account and sync">
        {sync && <p className="muted small">{syncLabel(sync)}</p>}

        {signedIn ? (
          <>
            <div className="ui-row">
              <Button variant="secondary" onClick={syncNowClick}>
                Sync now
              </Button>
              <Button variant="secondary" onClick={exportData}>
                Export my data
              </Button>
              <Button variant="secondary" onClick={makeInvite}>
                Create invite code
              </Button>
              <Button variant="danger" onClick={disconnect}>
                Sign out here
              </Button>
            </div>
            {newInvite && (
              <p>
                Invite code: <strong className="code">{newInvite}</strong>
              </p>
            )}
          </>
        ) : (
          <div className="ui-stack">
            <SegmentedControl label="Account action" options={MODES} value={mode} onChange={setMode} />
            <label className="field">
              Server address
              <input value={server} onChange={(e) => setServer(e.target.value)} autoCapitalize="none" />
            </label>
            <label className="field">
              Username
              <input value={username} onChange={(e) => setUsername(e.target.value)} autoCapitalize="none" autoComplete="username" />
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
            <Button onClick={account}>
              {mode === 'signin' ? 'Sign in and sync' : mode === 'signup' ? 'Create account' : 'Reset password'}
            </Button>
          </div>
        )}
      </Card>

      <p className="muted" role="status">
        {status}
      </p>
    </section>
  );
}
