// sw.js - simple cache with stale-while-revalidate for static assets and API responses
const VERSION = 'mr-silent-v2';
const STATIC_CACHE = `${VERSION}-static`;
const API_CACHE = `${VERSION}-api`;
const STATIC_ASSETS = [
  '/', '/index.html', '/videos.html', '/watch.html', '/shorts.html', '/playlists.html', '/about.html',
  '/css/style.css', '/js/script.js', '/js/shorts.js', '/assets/logo.png'
];

self.addEventListener('install', evt => {
  evt.waitUntil(
    caches.open(STATIC_CACHE).then(cache => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', evt => {
  evt.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(k => ![STATIC_CACHE, API_CACHE].includes(k)).map(k => caches.delete(k))
    ))
  );
  self.clients.claim();
});

self.addEventListener('fetch', evt => {
  const url = new URL(evt.request.url);

  if (evt.request.method !== 'GET') return;

  if (url.hostname.includes('googleapis.com') || url.hostname.includes('allorigins.win')) {
    evt.respondWith(staleWhileRevalidate(evt.request, API_CACHE));
    return;
  }

  if (STATIC_ASSETS.includes(url.pathname) || url.pathname.startsWith('/css/') || url.pathname.startsWith('/js/') || url.pathname.startsWith('/assets/')) {
    evt.respondWith(
      caches.match(evt.request).then(cached => cached || fetch(evt.request).then(res => {
        const copy = res.clone();
        caches.open(STATIC_CACHE).then(c => c.put(evt.request, copy));
        return res;
      })).catch(() => caches.match('/index.html'))
    );
    return;
  }

  evt.respondWith(
    fetch(evt.request).catch(() => caches.match(evt.request))
  );
});

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  const networkFetch = fetch(request).then(res => {
    if (res && res.ok) cache.put(request, res.clone());
    return res;
  }).catch(() => null);
  return cached || (await networkFetch) || new Response('', { status: 504 });
}
