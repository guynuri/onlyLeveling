// What the push settings can say (SPEC §6.4). Pure: the screen reads the browser and passes the facts in.
// On iPhone, push works only for an app installed to the Home Screen; the app says so and does not fail silently.
export type PushState = 'needs-install' | 'unsupported' | 'denied' | 'off' | 'on';

export interface PushFacts {
  standalone: boolean; // running from the Home Screen (display-mode standalone, or iOS navigator.standalone)
  hasPushManager: boolean; // the browser exposes push at all
  permission: 'default' | 'granted' | 'denied';
  subscribed: boolean; // this device holds a push subscription
}

export function pushState(f: PushFacts): PushState {
  if (!f.standalone) return 'needs-install';
  if (!f.hasPushManager) return 'unsupported';
  if (f.permission === 'denied') return 'denied';
  if (f.permission === 'granted' && f.subscribed) return 'on';
  return 'off';
}

// The on-screen words for each state. No internal terms (SPEC §4.2 applies here too).
export const PUSH_COPY: Record<PushState, string> = {
  'needs-install': 'Add onlyLeveling to your Home Screen to get rest alerts and reminders. Until then, they show only while the app is open.',
  unsupported: 'This browser cannot send notifications. Rest alerts and reminders show only while the app is open.',
  denied: 'Notifications are blocked for this app. Rest alerts and reminders show only while the app is open. Turn notifications on in iPhone Settings to get them.',
  off: 'Notifications are off.',
  on: 'Notifications are on.',
};
