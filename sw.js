/* © Mr. Si!ent Creator Hub — All Rights Reserved. */
var CACHE_STATIC = 'mrsilent-static-v2';
var CACHE_API    = 'mrsilent-api-v2';
var API_TTL      = 10 * 60 * 1000;

var STATIC_ASSETS = [
  '/', '/index.html', '/videos.html', '/watch.html', '/live.html',
  '/shorts.html', '/playlists.html', '/about.html',
  '/css/style.css', '/js/protect.js', '/js/script.js', '/js/shorts.js',
  '/assets/logo.png',
];

self.addEventListener('install', function (e) {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE_STATIC).then(function (cache) {
      return cache.addAll(STATIC_ASSETS.map(function (u) {
        return new Request(u, { cache: 'reload' });
      })).catch(function (err) { console.warn('[SW] Pre-cache partial fail:', err); });
    })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(
        keys.filter(function (k) { return k !== CACHE_STATIC && k !== CACHE_API; })
            .map(function (k) { return caches.delete(k); })
      );
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (e) {
  var url = new URL(e.request.url);

  if (url.hostname === 'www.googleapis.com') {
    e.respondWith(staleWhileRevalidate(e.request));
    return;
  }
  if (url.hostname === 'i.ytimg.com') {
    e.respondWith(cacheFirst(e.request, CACHE_STATIC));
    return;
  }
  if (url.origin === self.location.origin) {
    e.respondWith(cacheFirst(e.request, CACHE_STATIC));
    return;
  }
  e.respondWith(fetch(e.request));
});

function cacheFirst(request, cacheName) {
  return caches.open(cacheName).then(function (cache) {
    return cache.match(request).then(function (cached) {
      if (cached) return cached;
      return fetch(request).then(function (response) {
        if (response.ok) cache.put(request, response.clone());
        return response;
      }).catch(function () { return new Response('Offline', { status: 503 }); });
    });
  });
}

function staleWhileRevalidate(request) {
  return caches.open(CACHE_API).then(function (cache) {
    return cache.match(request).then(function (cached) {
      var fetchP = fetch(request).then(function (response) {
        if (response.ok) {
          var headers = new Headers(response.headers);
          headers.set('x-sw-ts', Date.now().toString());
          return response.clone().text().then(function (body) {
            cache.put(request, new Response(body, { status: response.status, headers: headers }));
            return response;
          });
        }
        return response;
      }).catch(function () { return null; });

      if (cached) {
        var ts = parseInt(cached.headers.get('x-sw-ts') || '0');
        if (Date.now() - ts < API_TTL) return cached;
        fetchP; // background refresh
        return cached;
      }
      return fetchP;
    });
  });
}
