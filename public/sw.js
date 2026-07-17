// PulseDeck service worker — deliberately conservative for a realtime app.
// Strategy: network-first for EVERYTHING except immutable static assets.
// Live data (RPCs, API routes, realtime) must never be served stale.
const VERSION = 'pd-v1';
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

  // Pages: network-first with cache fallback (offline shell for reopens)
  event.respondWith(
    fetch(event.request)
      .then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(STATIC_CACHE).then((c) => c.put(event.request, copy));
        }
        return res;
      })
      .catch(() => caches.match(event.request)),
  );
});
