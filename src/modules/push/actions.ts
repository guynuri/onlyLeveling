// App glue for push (PLAN Phase 9). Each call answers for itself: a failure is an error the screen shows, never a
// silent no-op. Permission must be asked from a tap (iOS), so turnOnPush is called from a button.
import { VAPID_PUBLIC_KEY } from './config';
import { readSyncState } from '../sync/actions';
import { getRepo, defaultSettings } from '../training/data';
import { pushState, type PushFacts, type PushState } from './domain/support';

function bytesFromB64u(s: string): Uint8Array {
  const pad = s.length % 4 === 0 ? '' : '='.repeat(4 - (s.length % 4));
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/') + pad);
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

async function call(method: 'POST' | 'DELETE', path: string, body?: unknown): Promise<void> {
  const cfg = (await readSyncState()).config;
  if (!cfg) throw new Error('Sign in to a server to use notifications.');
  const res = await fetch(`${cfg.baseUrl}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cfg.token}` },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Notifications: the server answered ${res.status}. Try again.`);
}

// The registration if one is active. `ready` would wait forever where no worker is active (dev builds), so the
// lookup does not use it.
async function registration(): Promise<ServiceWorkerRegistration> {
  if (!('serviceWorker' in navigator)) throw new Error('This browser has no service worker.');
  const reg = await navigator.serviceWorker.getRegistration();
  if (!reg) throw new Error('The app’s background worker is not active yet. Reload and try again.');
  return reg;
}

// The browser's side of push, for the settings screen.
export async function pushFacts(): Promise<PushFacts> {
  const standalone =
    window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
  const hasPushManager = 'serviceWorker' in navigator && 'PushManager' in window;
  const permission = 'Notification' in window ? Notification.permission : 'denied';
  let subscribed = false;
  if (hasPushManager) {
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      subscribed = reg ? (await reg.pushManager.getSubscription()) !== null : false;
    } catch {
      subscribed = false;
    }
  }
  return { standalone, hasPushManager, permission, subscribed };
}

export async function currentPushState(): Promise<PushState> {
  return pushState(await pushFacts());
}

// From a tap: asks for permission, subscribes this device, and stores the subscription on the server.
export async function turnOnPush(): Promise<void> {
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') throw new Error('Notifications were not allowed.');
  const reg = await registration();
  const sub =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: bytesFromB64u(VAPID_PUBLIC_KEY) as BufferSource }));
  const json = sub.toJSON();
  if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) throw new Error('The browser gave an incomplete subscription.');
  await call('POST', '/api/push/subscribe', { endpoint: json.endpoint, keys: { p256dh: json.keys.p256dh, auth: json.keys.auth } });
}

// Turns notifications off: the server forgets this device, then the browser drops its subscription.
export async function turnOffPush(): Promise<void> {
  const reg = await registration();
  const sub = await reg.pushManager.getSubscription();
  if (!sub) return;
  await call('POST', '/api/push/unsubscribe', { endpoint: sub.endpoint });
  await sub.unsubscribe();
}

// The reminder setting: saved on this device, then on the server (the server does the sending).
export async function saveReminder(enabled: boolean, time: string): Promise<void> {
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const repo = await getRepo();
  const s = (await repo.getSettings()) ?? defaultSettings();
  await repo.saveSettings({ ...s, reminder: { enabled, time } });
  await call('POST', '/api/push/reminder', { enabled, time, tz });
}

// Schedules the rest-end alert. Returns false when this device has no subscription: the on-screen timer still runs.
export async function scheduleRestAlert(fireAt: number): Promise<boolean> {
  const reg = await registration();
  if ((await reg.pushManager.getSubscription()) === null) return false;
  await call('POST', '/api/push/rest', { fireAt });
  return true;
}

export async function cancelRestAlert(): Promise<void> {
  await call('DELETE', '/api/push/rest');
}
