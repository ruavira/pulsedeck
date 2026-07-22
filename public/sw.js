// PulseDeck service worker — deliberately conservative for a realtime app.
// Strategy: network-first for EVERYTHING except immutable static assets.
// Live data (RPCs, API routes, realtime) must never be served stale.
const VERSION = 'pd-v2';
const STATIC_CACHE = `static-${VERSION}`;
const STATIC_PATHS = ['/icon-192.png', '/icon-512.png', '/manifest.webmanifest'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((c) => c.addAll(STATIC_PATHS)).then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== STATIC_CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET') return; // never touch writes
  if (url.origin !== self.location.origin) return; // never touch Supabase/external
  if (url.pathname.startsWith('/api/')) return; // API always network
  // Embed widgets run inside third-party iframes (Gamma, Notion, …). The SW must
  // never intercept them — go straight to the network, no caching, no interference.
  if (url.pathname.startsWith('/embed')) return;

  // Immutable Next static assets + our icons: cache-first
  if (url.pathname.startsWith('/_next/static/') || STATIC_PATHS.includes(url.pathname)) {
    event.respondWith(
      caches.match(event.request).then(
        (hit) =>
          hit ??
          fetch(event.request).then((res) => {
            const copy = res.clone();
            caches.open(STATIC_CACHE).then((c) => c.put(event.request, copy));
            return res;
          }),
      ),
    );
    return;
  }

  // Pages: network-first with cache fallback (offline shell for reopens).
  // The fallback MUST resolve to a Response — caches.match() resolves to
  // undefined on a miss, and respondWith(undefined) throws
  // "Failed to convert value to 'Response'" and breaks the navigation.
  event.respondWith(
    fetch(event.request)
      .then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(STATIC_CACHE).then((c) => c.put(event.request, copy));
        }
        return res;
      })
      .catch(async () => (await caches.match(event.request)) || Response.error()),
  );
});
