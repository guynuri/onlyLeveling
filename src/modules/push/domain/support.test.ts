import { describe, it, expect } from 'vitest';
import { pushState, PUSH_COPY, type PushFacts } from './support';

const base: PushFacts = { standalone: true, hasPushManager: true, permission: 'default', subscribed: false };

describe('push state', () => {
  it('outside the Home Screen app, the state is needs-install whatever else is true', () => {
    expect(pushState({ ...base, standalone: false, permission: 'granted', subscribed: true })).toBe('needs-install');
  });

  it('a browser without push is unsupported', () => {
    expect(pushState({ ...base, hasPushManager: false })).toBe('unsupported');
  });

  it('a blocked permission is denied, and the copy says alerts show only while open', () => {
    expect(pushState({ ...base, permission: 'denied' })).toBe('denied');
    expect(PUSH_COPY.denied).toMatch(/only while the app is open/);
  });

  it('on needs both permission and a subscription on this device', () => {
    expect(pushState({ ...base, permission: 'granted', subscribed: true })).toBe('on');
    expect(pushState({ ...base, permission: 'granted', subscribed: false })).toBe('off');
    expect(pushState(base)).toBe('off');
  });
});
