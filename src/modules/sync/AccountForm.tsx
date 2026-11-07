// Sign in, create an account with an invite, or reset a password. Used by the sign-in screen (signing in is required,
// owner decision 2026-11-07) and by Settings. All three end the same way: the session is stored, then the device syncs.
import { useState } from 'react';
import { signInWithPassword, createAccountWithInvite, recoverAccount } from './actions';
import type { SyncState } from '../../data/sync-engine';
import { AuthClientError } from '../../data/auth-client';
import { Button } from '../../ui/primitives';
import { SegmentedControl } from '../../ui/controls';

export const DEFAULT_SERVER = 'https://onlyleveling-api.guynuri.workers.dev';
type Mode = 'signin' | 'signup' | 'recover';
const MODES = [
  { value: 'signin', label: 'Sign in' },
  { value: 'signup', label: 'New account' },
  { value: 'recover', label: 'Forgot' },
] as const;

export function messageOf(e: unknown): string {
  if (e instanceof AuthClientError) return e.message;
  return e instanceof Error ? e.message : 'Something went wrong. Try again.';
}

export function AccountForm(props: { onSignedIn: (after: SyncState) => void; server?: string }) {
  const [server, setServer] = useState(props.server ?? DEFAULT_SERVER);
  const [mode, setMode] = useState<Mode>('signin');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    setStatus('Working…');
    try {
      let after: SyncState;
      if (mode === 'signin') after = await signInWithPassword(server, username.trim(), password);
      else if (mode === 'signup') after = await createAccountWithInvite(server, { code: code.trim(), username: username.trim(), password });
      else after = await recoverAccount(server, { username: username.trim(), code: code.trim(), newPassword: password });
      setPassword('');
      setCode('');
      setStatus(after.lastError ? `Signed in, but sync failed: ${after.lastError}` : 'Signed in and synced.');
      props.onSignedIn(after);
    } catch (e) {
      setStatus(messageOf(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      className="ui-stack"
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
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
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={mode === 'signin' ? 'current-password' : 'new-password'} />
      </label>
      <Button type="submit" disabled={busy}>
        {mode === 'signin' ? 'Sign in and sync' : mode === 'signup' ? 'Create account' : 'Reset password'}
      </Button>
      <p className="muted small" role="status">
        {status}
      </p>
    </form>
  );
}
