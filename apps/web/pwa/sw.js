// Haku's service worker. It keeps the app and every sample in the cache, so the installed app opens
// even when `haku web` isn't running. The build fills in the file list and the cache version.

const CACHE = 'haku-__VERSION__';
const PRECACHE = __PRECACHE__;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('haku-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;

  // Pages try the network first so a newer Haku shows up, and fall back to the cached app.
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).catch(() => caches.match('/', { cacheName: CACHE })));
    return;
  }

  // Everything else is versioned by this cache, so the cache wins.
  event.respondWith(caches.match(request, { cacheName: CACHE }).then((hit) => hit ?? fetch(request)));
});
