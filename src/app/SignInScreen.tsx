// Signing in is required (owner decision 2026-11-07): the account is the backup and the AI runs on the server. The app
// shows this screen until a session exists on the device; after it, onboarding (if unfinished) and then Home.
import { AccountForm } from '../modules/sync/AccountForm';
import { Card } from '../ui/primitives';

export default function SignInScreen() {
  return (
    <section className="ui-stack">
      <h1>Welcome</h1>
      <p className="muted">Sign in to start. Your training is saved to your account, so a new phone gets it all back.</p>
      <Card>
        <AccountForm onSignedIn={() => (window.location.hash = '#/home')} />
      </Card>
    </section>
  );
}
