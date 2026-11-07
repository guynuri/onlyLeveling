// The service worker (PLAN Phase 9, SPEC §6.4). Built by vite-plugin-pwa (injectManifest): it precaches the app for
// offline use, shows the push alerts, and opens the app on a tap. The scope is the app's base path.
import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching';

const ICON = 'icons/icon-192.png';
const APP_URL = 'https://guynuri.github.io/onlyLeveling/#/home';

interface Message {
  title: string;
  body: string;
  kind: 'rest' | 'reminder';
}

interface PushLike {
  data?: { json(): unknown };
  waitUntil(p: Promise<unknown>): void;
}
interface ClickLike {
  notification: { close(): void };
  waitUntil(p: Promise<unknown>): void;
}
interface ActivateLike {
  waitUntil(p: Promise<unknown>): void;
}
interface FetchLike {
  request: Request;
  respondWith(r: Promise<Response>): void;
}

// The server sends only what the app knows how to show. Anything else gets a plain, safe default.
function readMessage(raw: unknown): Message {
  const o = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>;
  const kind = o.kind === 'rest' || o.kind === 'reminder' ? o.kind : 'reminder';
  return {
    kind,
    title: typeof o.title === 'string' ? o.title.slice(0, 80) : 'train-train-train',
    body: typeof o.body === 'string' ? o.body.slice(0, 160) : '',
  };
}

// The precache list is injected at build time into this exact expression (vite-plugin-pwa looks for it).
// @ts-expect-error the app's DOM types do not declare __WB_MANIFEST; the build provides it
precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();

// Typed by hand: the worker scope has its own globals, and the app's DOM types do not describe them.
const sw = self as unknown as {
  skipWaiting(): Promise<void>;
  clients: { claim(): Promise<void>; openWindow(url: string): Promise<unknown> };
  registration: { showNotification(title: string, options: { body: string; tag: string; icon: string }): Promise<void> };
  addEventListener(type: 'install', listener: () => void): void;
  addEventListener(type: 'activate', listener: (e: ActivateLike) => void): void;
  addEventListener(type: 'push', listener: (e: PushLike) => void): void;
  addEventListener(type: 'notificationclick', listener: (e: ClickLike) => void): void;
  addEventListener(type: 'fetch', listener: (e: FetchLike) => void): void;
};

// Exercise pictures (U2): too many to precache (~12 MB), so each one is cached the first time it is shown and served
// from the cache after that, offline included. Registered after precacheAndRoute, which handles app files first.
const MEDIA_CACHE = 'repdb-media-v1';
sw.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin || !url.pathname.includes('/media/repdb/')) return;
  e.respondWith(
    caches.open(MEDIA_CACHE).then(async (cache) => {
      const hit = await cache.match(e.request);
      if (hit) return hit;
      const res = await fetch(e.request);
      if (res.ok) await cache.put(e.request, res.clone());
      return res;
    }),
  );
});

// autoUpdate (vite.config.ts): a new build takes over on its own.
sw.addEventListener('install', () => {
  void sw.skipWaiting();
});
sw.addEventListener('activate', (e) => {
  e.waitUntil(sw.clients.claim());
});

sw.addEventListener('push', (e) => {
  const msg = readMessage(e.data?.json());
  // One notification per kind: a newer rest alert replaces an older one rather than piling up.
  e.waitUntil(sw.registration.showNotification(msg.title, { body: msg.body, tag: msg.kind, icon: ICON }));
});

sw.addEventListener('notificationclick', (e) => {
  e.notification.close();
  e.waitUntil(sw.clients.openWindow(APP_URL));
});
