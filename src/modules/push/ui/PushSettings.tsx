// Notifications in Settings (SPEC §6.4): the state in plain words, a button to turn them on, and the workout reminder.
// Every failure is shown here. Nothing fails silently.
import { useEffect, useState } from 'react';
import { getRepo, defaultSettings } from '../../training/data';
import { PUSH_COPY, type PushState } from '../domain/support';
import { currentPushState, turnOnPush, turnOffPush, saveReminder } from '../actions';

export function PushSettings() {
  const [state, setState] = useState<PushState | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [time, setTime] = useState('18:00');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      setState(await currentPushState());
      const s = (await (await getRepo()).getSettings()) ?? defaultSettings();
      if (s.reminder) {
        setEnabled(s.reminder.enabled);
        setTime(s.reminder.time);
      }
    })().catch(() => setError('Could not read the notification state.'));
  }, []);

  const run = async (fn: () => Promise<void>, ok: string) => {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await fn();
      setMessage(ok);
      setState(await currentPushState());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save that. Try again.');
    } finally {
      setBusy(false);
    }
  };

  // A failed read shows its message here; the spinner is only for a read still in progress.
  if (!state) return error ? <p className="error">{error}</p> : <p className="muted">Checking notifications…</p>;

  return (
    <section aria-label="Notifications">
      <h2>Notifications</h2>
      <p className="muted small">{PUSH_COPY[state]}</p>

      {state === 'off' && (
        <button type="button" disabled={busy} onClick={() => run(turnOnPush, 'Notifications are on.')}>
          Turn on notifications
        </button>
      )}

      {state === 'on' && (
        <button type="button" disabled={busy} onClick={() => run(turnOffPush, 'Notifications are off.')}>
          Turn off notifications
        </button>
      )}

      {state === 'on' && (
        <div className="reminder">
          <label className="field">
            <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} /> Workout reminder
          </label>
          <label className="field">
            Time
            <input type="time" value={time} onChange={(e) => setTime(e.target.value)} disabled={!enabled} />
          </label>
          <p className="muted small">
            Sent on training days until this week’s sessions are done. Timing depends on iPhone background scheduling, so it
            may be a few minutes late.
          </p>
          <button type="button" disabled={busy} onClick={() => run(() => saveReminder(enabled, time), 'Reminder saved.')}>
            Save reminder
          </button>
        </div>
      )}

      {message && <p className="small">{message}</p>}
      {error && <p className="error">{error}</p>}
    </section>
  );
}
