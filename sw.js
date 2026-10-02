// sw.js - Service worker: makes Talk Board work offline.
// ---------------------------------------------------------------------------
// - The app files are saved on first visit.
// - After that the saved copy opens instantly (even with no internet), and
//   a fresh copy is fetched in the background for next time.
// - The camera eye-tracking files (about 15 MB) are saved the first time
//   camera tracking is turned on, not on first visit.
//
// When you change the app, bump CACHE_VERSION so old copies are cleared.
// Open the app twice after an update to see the new version.
// ---------------------------------------------------------------------------

const CACHE_VERSION = 'v1';
const APP_CACHE = `talkboard-app-${CACHE_VERSION}`;
const TRACKER_CACHE = 'talkboard-tracker-mediapipe-1.0.1'; // big files, kept across app updates

const APP_FILES = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/app.css',
  './js/app.js',
  './js/board.js',
  './js/dwell.js',
  './js/editor.js',
  './js/gaze.js',
  './js/keyboard.js',
  './js/speech.js',
  './js/storage.js',
  './js/util.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(APP_CACHE).then((cache) => cache.addAll(APP_FILES)).then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys
        .filter((k) => k !== APP_CACHE && k !== TRACKER_CACHE)
        .map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Eye tracker files never change: use the saved copy if we have one.
  if (url.pathname.includes('/vendor/mediapipe/')) {
    event.respondWith(cacheFirst(req, TRACKER_CACHE));
    return;
  }
  // App files: saved copy now, refresh in the background.
  event.respondWith(staleWhileRevalidate(req, APP_CACHE));
});

async function cacheFirst(req, cacheName) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok) cache.put(req, res.clone());
  return res;
}

async function staleWhileRevalidate(req, cacheName) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(req, { ignoreSearch: true });
  const network = fetch(req)
    .then((res) => {
      if (res.ok) cache.put(req, res.clone());
      return res;
    })
    .catch(() => null);
  if (hit) return hit;
  const res = await network;
  if (res) return res;
  // Offline and never saved: fall back to the main page for navigations.
  if (req.mode === 'navigate') return (await cache.match('./index.html')) || Response.error();
  return Response.error();
}
