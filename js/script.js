/* © Mr. Si!ent Creator Hub — All Rights Reserved. */
(function () {
  'use strict';

  /* ── Config ─────────────────────────────────────────────── */
  var API_KEY    = 'AIzaSyAEBSwFQQHGdg7EdKTWXaBvl6b6cOhFpXc';
  var CHANNEL_ID = window.CHANNEL_ID || 'UCKQ_q75TKeAcYXYeu0uaWlQ';
  var API_BASE   = 'https://www.googleapis.com/youtube/v3';
  var RSS_PROXY  = 'https://api.allorigins.win/raw?url=';
  var PAGE_SIZE  = 12;
  var CACHE_TTL  = { subs: 5 * 60000, videos: 10 * 60000, playlists: 15 * 60000 };

  /* ── Cache ───────────────────────────────────────────────── */
  function setCache(key, data) {
    try { localStorage.setItem(key, JSON.stringify({ ts: Date.now(), data: data })); } catch (e) {}
  }
  function getCache(key, ttl) {
    try {
      var raw = localStorage.getItem(key);
      if (!raw) return null;
      var obj = JSON.parse(raw);
      if (Date.now() - obj.ts > ttl) return null;
      return obj.data;
    } catch (e) { return null; }
  }

  /* ── API Fetch ───────────────────────────────────────────── */
  function apiFetch(endpoint, params) {
    var url = new URL(API_BASE + '/' + endpoint);
    url.searchParams.set('key', API_KEY);
    Object.keys(params || {}).forEach(function (k) { url.searchParams.set(k, params[k]); });
    return fetch(url.toString()).then(function (res) {
      if (!res.ok) throw new Error('API ' + res.status);
      return res.json();
    });
  }

  /* ── Channel Info (subs + avatar + desc) ─────────────────── */
  function fetchChannelInfo() {
    var ck = 'ch_' + CHANNEL_ID;
    var cached = getCache(ck, CACHE_TTL.subs);
    if (cached) return Promise.resolve(cached);
    return apiFetch('channels', { part: 'statistics,snippet', id: CHANNEL_ID })
      .then(function (data) {
        var ch = data.items && data.items[0];
        if (!ch) return null;
        var info = {
          subs:  parseInt(ch.statistics.subscriberCount || 0),
          views: parseInt(ch.statistics.viewCount || 0),
          videos: parseInt(ch.statistics.videoCount || 0),
          desc:  ch.snippet.description || '',
          title: ch.snippet.title || 'Mr. Si!ent',
          thumb: (ch.snippet.thumbnails.high || ch.snippet.thumbnails.medium || ch.snippet.thumbnails.default || {}).url || '',
        };
        setCache(ck, info);
        return info;
      });
  }

  /* ── Videos (one page) ───────────────────────────────────── */
  function fetchVideosPage(pageToken, maxResults) {
    var p = { part: 'snippet', channelId: CHANNEL_ID, order: 'date', type: 'video', maxResults: maxResults || PAGE_SIZE };
    if (pageToken) p.pageToken = pageToken;
    return apiFetch('search', p);
  }

  /* ── ALL videos paginated ────────────────────────────────── */
  function fetchAllVideos() {
    var ck = 'allv_' + CHANNEL_ID;
    var cached = getCache(ck, CACHE_TTL.videos);
    if (cached) return Promise.resolve(cached);

    var all = [];
    function next(token) {
      return fetchVideosPage(token, 50).then(function (data) {
        all = all.concat(data.items || []);
        if (data.nextPageToken) return next(data.nextPageToken);
        setCache(ck, all);
        return all;
      });
    }
    return next(null);
  }

  /* ── Video Details batch ─────────────────────────────────── */
  function fetchVideoDetails(ids) {
    if (!ids || !ids.length) return Promise.resolve([]);
    var batches = [];
    for (var i = 0; i < ids.length; i += 50) batches.push(ids.slice(i, i + 50));
    return Promise.all(batches.map(function (b) {
      return apiFetch('videos', { part: 'contentDetails,statistics', id: b.join(',') })
        .then(function (d) { return d.items || []; });
    })).then(function (results) {
      return results.reduce(function (a, b) { return a.concat(b); }, []);
    });
  }

  /* ── Playlists ───────────────────────────────────────────── */
  function fetchPlaylists() {
    var ck = 'pl_' + CHANNEL_ID;
    var cached = getCache(ck, CACHE_TTL.playlists);
    if (cached) return Promise.resolve(cached);

    var all = [];
    function next(token) {
      var p = { part: 'snippet,contentDetails', channelId: CHANNEL_ID, maxResults: 50 };
      if (token) p.pageToken = token;
      return apiFetch('playlists', p).then(function (data) {
        all = all.concat(data.items || []);
        if (data.nextPageToken) return next(data.nextPageToken);
        setCache(ck, all);
        return all;
      });
    }
    return next(null);
  }

  /* ── RSS Fallback ────────────────────────────────────────── */
  function fetchVideosFallback() {
    var rss = 'https://www.youtube.com/feeds/videos.xml?channel_id=' + CHANNEL_ID;
    return fetch(RSS_PROXY + encodeURIComponent(rss))
      .then(function (r) { return r.text(); })
      .then(function (text) {
        var parser = new DOMParser();
        var xml = parser.parseFromString(text, 'application/xml');
        return Array.from(xml.querySelectorAll('entry')).map(function (e) {
          var vid = e.querySelector('videoId') ? e.querySelector('videoId').textContent : '';
          return {
            id: { videoId: vid },
            snippet: {
              title: e.querySelector('title') ? e.querySelector('title').textContent : '',
              publishedAt: e.querySelector('published') ? e.querySelector('published').textContent : '',
              thumbnails: { mqdefault: { url: 'https://i.ytimg.com/vi/' + vid + '/mqdefault.jpg' } },
            },
          };
        });
      });
  }

  /* ── Helpers ─────────────────────────────────────────────── */
  function thumbMQ(id) { return 'https://i.ytimg.com/vi/' + id + '/mqdefault.jpg'; }
  function thumbHQ(id) { return 'https://i.ytimg.com/vi/' + id + '/maxresdefault.jpg'; }

  function formatNum(n) {
    n = parseInt(n);
    if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
    if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
    return n.toLocaleString();
  }
  function formatDate(iso) {
    if (!iso) return '';
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  /* ── Lazy + Progressive Image Load ──────────────────────── */
  function observeImages() {
    if (!('IntersectionObserver' in window)) {
      document.querySelectorAll('img[data-src]').forEach(function (img) {
        img.src = img.dataset.src; img.classList.add('loaded');
      });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        var img = entry.target;
        var hq  = img.dataset.hq;
        if (hq) {
          var loader = new Image();
          loader.onload = function () { img.src = hq; img.classList.add('loaded'); };
          loader.src = hq;
        } else {
          img.src = img.dataset.src;
          img.onload = function () { img.classList.add('loaded'); };
        }
        io.unobserve(img);
      });
    }, { rootMargin: '200px' });
    document.querySelectorAll('img[data-src]').forEach(function (img) { io.observe(img); });
  }

  /* ── Build Video Card ────────────────────────────────────── */
  function buildVideoCard(item) {
    var vid   = (item.id && item.id.videoId) || '';
    var title = (item.snippet && item.snippet.title) || '';
    var date  = formatDate(item.snippet && item.snippet.publishedAt);
    var esc   = title.replace(/"/g, '&quot;').replace(/</g, '&lt;');
    return '<a href="watch.html?id=' + vid + '" class="video-card fade-up" aria-label="' + esc + '">' +
      '<div class="thumb-wrap">' +
        '<img data-src="' + thumbMQ(vid) + '" data-hq="' + thumbHQ(vid) + '" src="' + thumbMQ(vid) + '" alt="' + esc + '" loading="lazy" />' +
        '<div class="thumb-overlay"><div class="play-btn">&#9654;</div></div>' +
      '</div>' +
      '<div class="video-info">' +
        '<div class="video-title">' + title + '</div>' +
        '<div class="video-meta">' + date + '</div>' +
      '</div></a>';
  }

  /* ── Build Trending Card ─────────────────────────────────── */
  function buildTrendingCard(item, num) {
    var vid   = (item.id && item.id.videoId) || '';
    var title = (item.snippet && item.snippet.title) || '';
    var esc   = title.replace(/"/g, '&quot;').replace(/</g, '&lt;');
    return '<a href="watch.html?id=' + vid + '" class="trending-card fade-up" style="animation-delay:' + (num * 0.08) + 's" aria-label="' + esc + '">' +
      '<img data-src="' + thumbMQ(vid) + '" data-hq="' + thumbHQ(vid) + '" src="' + thumbMQ(vid) + '" alt="' + esc + '" loading="lazy" />' +
      '<div class="trending-overlay">' +
        '<div class="trending-num">0' + (num + 1) + '</div>' +
        '<div class="trending-title">' + title + '</div>' +
      '</div></a>';
  }

  /* ── Animated Counter ────────────────────────────────────── */
  function animateCount(el, target, suffix) {
    var start = performance.now();
    var dur   = 1800;
    function step(now) {
      var p = Math.min((now - start) / dur, 1);
      var e = 1 - Math.pow(1 - p, 3);
      el.textContent = formatNum(Math.floor(e * target)) + (suffix || '');
      if (p < 1) requestAnimationFrame(step);
      else el.textContent = formatNum(target) + (suffix || '');
    }
    requestAnimationFrame(step);
  }

  /* ── Mobile Nav ──────────────────────────────────────────── */
  function initMobileNav() {
    var btn     = document.getElementById('hamburger');
    var overlay = document.getElementById('nav-overlay');
    var closeBtn = document.getElementById('nav-close');
    if (!btn || !overlay) return;

    function open() {
      overlay.classList.add('open');
      btn.setAttribute('aria-expanded', 'true');
      overlay.removeAttribute('aria-hidden');
    }
    function close() {
      overlay.classList.remove('open');
      btn.setAttribute('aria-expanded', 'false');
      overlay.setAttribute('aria-hidden', 'true');
    }

    btn.addEventListener('click', open);
    if (closeBtn) closeBtn.addEventListener('click', close);
    overlay.addEventListener('click', function (e) { if (e.target === overlay) close(); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') close(); });
  }

  /* ── Highlight Active Nav ────────────────────────────────── */
  function highlightNav() {
    var page = location.pathname.split('/').pop() || 'index.html';
    document.querySelectorAll('.nav-link').forEach(function (link) {
      var href = link.getAttribute('href') || '';
      if (href === page || (page === 'index.html' && href === 'index.html')) {
        link.classList.add('active');
      } else {
        link.classList.remove('active');
      }
    });
  }

  /* ── HOME PAGE ───────────────────────────────────────────── */
  function initHomePage() {
    var grid     = document.getElementById('home-grid');
    var trending = document.getElementById('trending-grid');
    var subEl    = document.getElementById('sub-count');

    // Subscriber counter
    if (subEl) {
      fetchChannelInfo().then(function (info) {
        if (!info) { subEl.textContent = 'Subscribe'; return; }
        animateCount(subEl, info.subs, ' subscribers');
        if (info.thumb) {
          document.querySelectorAll('.sidebar-logo, .hero-avatar, .about-avatar').forEach(function (img) {
            img.src = info.thumb;
          });
        }
      }).catch(function () { if (subEl) subEl.textContent = 'Subscribe'; });
    }

    // Videos
    if (!grid && !trending) return;

    function renderVideos(items) {
      if (grid) {
        grid.innerHTML = items.slice(0, PAGE_SIZE).map(buildVideoCard).join('');
      }
      if (trending) {
        trending.innerHTML = items.slice(0, 3).map(buildTrendingCard).join('');
      }
      observeImages();
      initHomeSearch(items, grid);
    }

    fetchVideosPage(null, PAGE_SIZE)
      .then(function (data) { renderVideos(data.items || []); })
      .catch(function (err) {
        console.warn('Home API failed, trying RSS…', err);
        fetchVideosFallback()
          .then(renderVideos)
          .catch(function () {
            if (grid) grid.innerHTML = '<div class="empty-state"><div class="empty-icon">&#128225;</div>Could not load videos. Check connection.</div>';
          });
      });
  }

  /* ── Home Search ─────────────────────────────────────────── */
  function initHomeSearch(items, grid) {
    var input = document.getElementById('search-input');
    if (!input || !grid) return;
    var timer;
    input.addEventListener('input', function () {
      clearTimeout(timer);
      timer = setTimeout(function () {
        var q = input.value.trim().toLowerCase();
        if (!q) {
          grid.innerHTML = items.map(buildVideoCard).join('');
          observeImages();
          return;
        }
        var filtered = items.filter(function (v) {
          return ((v.snippet && v.snippet.title) || '').toLowerCase().indexOf(q) !== -1;
        });
        grid.innerHTML = filtered.length
          ? filtered.map(buildVideoCard).join('')
          : '<div class="empty-state"><div class="empty-icon">&#128269;</div>No videos found.</div>';
        observeImages();
      }, 280);
    });
  }

  /* ── VIDEOS PAGE ─────────────────────────────────────────── */
  var _vPageToken  = null;
  var _vLoading    = false;
  var _vAllLoaded  = [];

  function initVideosPage() {
    var grid      = document.getElementById('videos-grid');
    var loadBtn   = document.getElementById('load-more-btn');
    var searchEl  = document.getElementById('videos-search');
    if (!grid) return;

    function loadChunk() {
      if (_vLoading) return;
      _vLoading = true;
      if (loadBtn) { loadBtn.disabled = true; loadBtn.textContent = 'Loading…'; }

      fetchVideosPage(_vPageToken, PAGE_SIZE)
        .then(function (data) {
          var items = data.items || [];
          _vPageToken = data.nextPageToken || null;
          _vAllLoaded = _vAllLoaded.concat(items);

          var html = items.map(buildVideoCard).join('');
          var tmp = document.createElement('div');
          tmp.innerHTML = html;
          var frag = document.createDocumentFragment();
          while (tmp.firstChild) frag.appendChild(tmp.firstChild);
          grid.appendChild(frag);
          observeImages();

          if (!_vPageToken) {
            if (loadBtn) loadBtn.style.display = 'none';
          } else {
            if (loadBtn) { loadBtn.disabled = false; loadBtn.textContent = 'Load More'; }
          }
        })
        .catch(function (err) {
          console.error(err);
          if (loadBtn) { loadBtn.disabled = false; loadBtn.textContent = 'Retry'; }
        })
        .then(function () { _vLoading = false; });
    }

    loadChunk();
    if (loadBtn) loadBtn.addEventListener('click', loadChunk);

    if (searchEl) {
      var timer;
      searchEl.addEventListener('input', function () {
        clearTimeout(timer);
        timer = setTimeout(function () {
          var q = searchEl.value.trim().toLowerCase();
          grid.querySelectorAll('.video-card').forEach(function (card) {
            var t = (card.querySelector('.video-title') || {}).textContent || '';
            card.style.display = t.toLowerCase().indexOf(q) !== -1 ? '' : 'none';
          });
          if (loadBtn) loadBtn.style.display = q ? 'none' : (_vPageToken ? '' : 'none');
        }, 280);
      });
    }
  }

  /* ── WATCH PAGE ──────────────────────────────────────────── */
  function initWatchPage() {
    var params  = new URLSearchParams(location.search);
    var videoId = params.get('id');
    var playerEl = document.getElementById('watch-player');

    if (!videoId) {
      if (playerEl) playerEl.innerHTML = '<div class="empty-state"><div class="empty-icon">&#128253;</div>No video specified.</div>';
      return;
    }

    if (playerEl) {
      playerEl.innerHTML = '<iframe src="https://www.youtube.com/embed/' + videoId +
        '?autoplay=0&rel=0" title="Video player" allow="accelerometer; autoplay; ' +
        'clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>';
    }

    apiFetch('videos', { part: 'snippet,statistics', id: videoId })
      .then(function (data) {
        var item = data.items && data.items[0];
        if (!item) return;
        var titleEl = document.getElementById('watch-title');
        var metaEl  = document.getElementById('watch-meta');
        if (titleEl) titleEl.textContent = item.snippet.title;
        if (metaEl) {
          metaEl.textContent = formatNum(item.statistics.viewCount || 0) + ' views · ' +
            formatDate(item.snippet.publishedAt);
        }
        document.title = item.snippet.title + ' — Mr. Si!ent';
      })
      .catch(function (e) { console.warn(e); });

    var upNextEl = document.getElementById('up-next-list');
    if (upNextEl) {
      fetchVideosPage(null, 8)
        .then(function (data) {
          var items = (data.items || []).filter(function (v) {
            return (v.id && v.id.videoId) !== videoId;
          }).slice(0, 6);
          upNextEl.innerHTML = items.map(function (v) {
            var vid   = (v.id && v.id.videoId) || '';
            var title = (v.snippet && v.snippet.title) || '';
            var date  = formatDate(v.snippet && v.snippet.publishedAt);
            var esc   = title.replace(/"/g, '&quot;').replace(/</g, '&lt;');
            return '<a href="watch.html?id=' + vid + '" class="up-next-item">' +
              '<img class="up-next-thumb" src="' + thumbMQ(vid) + '" alt="' + esc + '" loading="lazy" />' +
              '<div><div class="up-next-title">' + title + '</div>' +
              '<div class="up-next-meta">' + date + '</div></div></a>';
          }).join('');
        })
        .catch(function (e) { console.warn(e); });
    }
  }

  /* ── PLAYLISTS PAGE ──────────────────────────────────────── */
  function initPlaylistsPage() {
    var grid = document.getElementById('playlists-grid');
    if (!grid) return;
    grid.innerHTML = '<div class="spinner-wrap"><div class="spinner"></div></div>';

    fetchPlaylists()
      .then(function (playlists) {
        if (!playlists.length) {
          grid.innerHTML = '<div class="empty-state"><div class="empty-icon">&#128194;</div>No public playlists found.</div>';
          return;
        }
        grid.innerHTML = playlists.map(function (pl) {
          var id    = pl.id;
          var title = (pl.snippet && pl.snippet.title) || '';
          var count = (pl.contentDetails && pl.contentDetails.itemCount) || 0;
          var esc   = title.replace(/"/g, '&quot;').replace(/</g, '&lt;');
          return '<div class="playlist-card fade-up">' +
            '<div class="playlist-title">' + title + '</div>' +
            '<div class="playlist-count">' + count + ' video' + (count !== 1 ? 's' : '') + '</div>' +
            '<div class="responsive-embed" style="border-radius:0 0 14px 14px;border-top:none;">' +
              '<iframe src="https://www.youtube.com/embed/videoseries?list=' + id + '" title="' + esc +
              '" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen loading="lazy"></iframe>' +
            '</div></div>';
        }).join('');
      })
      .catch(function (err) {
        grid.innerHTML = '<div class="empty-state"><div class="empty-icon">&#9888;&#65039;</div>Failed to load playlists.</div>';
        console.error(err);
      });
  }

  /* ── ABOUT PAGE ──────────────────────────────────────────── */
  function initAboutPage() {
    fetchChannelInfo().then(function (info) {
      if (!info) return;
      if (info.thumb) {
        document.querySelectorAll('.about-avatar, .sidebar-logo').forEach(function (img) {
          img.src = info.thumb;
        });
      }
      var descEl = document.getElementById('channel-desc');
      if (descEl && info.desc) descEl.textContent = info.desc;

      var subEl = document.getElementById('about-sub-count');
      if (subEl) animateCount(subEl, info.subs, '');

      var subElH = document.getElementById('sub-count');
      if (subElH) animateCount(subElH, info.subs, ' subscribers');
    }).catch(function (e) { console.warn(e); });
  }

  /* ── Expose for shorts.js ────────────────────────────────── */
  window._mrSilent = {
    fetchAllVideos:    fetchAllVideos,
    fetchVideoDetails: fetchVideoDetails,
    thumbMQ:           thumbMQ,
    thumbHQ:           thumbHQ,
    CHANNEL_ID:        CHANNEL_ID,
  };

  /* ── Service Worker Registration ────────────────────────── */
  function registerSW() {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('sw.js').catch(function (e) { console.warn('SW:', e); });
    }
  }

  /* ── Init ────────────────────────────────────────────────── */
  function init() {
    highlightNav();
    initMobileNav();
    registerSW();

    var page = location.pathname.split('/').pop() || 'index.html';
    if (page === 'index.html' || page === '')  initHomePage();
    else if (page === 'videos.html')           initVideosPage();
    else if (page === 'watch.html')            initWatchPage();
    else if (page === 'playlists.html')        initPlaylistsPage();
    else if (page === 'about.html')            initAboutPage();
    // shorts.html handled by shorts.js
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

})();
