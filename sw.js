/* DOD Tracker — Service Worker
   Cache-first app shell strategy: the whole app is a single HTML file
   with inline CSS/JS, so caching that one file (plus the manifest and
   icons) is enough to make the entire app work fully offline once
   installed. Bump CACHE_VERSION whenever you push a new build so
   returning users get the update instead of a stale cached copy. */

const CACHE_VERSION = 'dod-tracker-v3';
const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './icon-72.png',
  './icon-96.png',
  './icon-128.png',
  './icon-144.png',
  './icon-152.png',
  './icon-192.png',
  './icon-384.png',
  './icon-512.png',
  './icon-maskable-192.png',
  './icon-maskable-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION)
      .then((cache) => {
        // cache.addAll() fails ENTIRELY if even one URL 404s (e.g. an
        // icon that didn't upload correctly), which can leave the whole
        // service worker stuck uninstalled. Cache each file independently
        // instead, so one bad path doesn't take down the rest.
        return Promise.all(
          APP_SHELL.map((url) =>
            cache.add(url).catch((err) => {
              console.warn('SW: failed to cache', url, err);
            })
          )
        );
      })
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((key) => key !== CACHE_VERSION)
            .map((key) => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

// Cache-first for everything in our own origin (the app shell never
// needs the network once cached); network-first fallback for anything
// else, so a stray external request doesn't hard-fail offline.
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  const isSameOrigin = url.origin === self.location.origin;

  if (isSameOrigin) {
    event.respondWith(
      caches.match(req).then((cached) => {
        if (cached) return cached;
        return fetch(req).then((res) => {
          const resClone = res.clone();
          caches.open(CACHE_VERSION).then((cache) => cache.put(req, resClone));
          return res;
        }).catch(() => caches.match('./index.html'));
      })
    );
  } else {
    event.respondWith(
      fetch(req).catch(() => caches.match(req))
    );
  }
});
