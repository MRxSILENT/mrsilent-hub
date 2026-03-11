/* © Mr. Si!ent Creator Hub — All Rights Reserved. */
(function () {
  'use strict';

  var API_KEY    = 'AIzaSyAEBSwFQQHGdg7EdKTWXaBvl6b6cOhFpXc';
  var CHANNEL_ID = window.CHANNEL_ID || 'UCKQ_q75TKeAcYXYeu0uaWlQ';
  var API_BASE   = 'https://www.googleapis.com/youtube/v3';
  var RSS_PROXY  = 'https://api.allorigins.win/raw?url=';
  var PAGE_SIZE  = 12;
  var CACHE_TTL  = { subs: 300000, videos: 600000, playlists: 900000, stats: 900000 };

  /* ── Cache ─────────────────────────────────────────────── */
  function setCache(k, d) { try { localStorage.setItem(k, JSON.stringify({ ts: Date.now(), data: d })); } catch (e) {} }
  function getCache(k, ttl) {
    try { var r = JSON.parse(localStorage.getItem(k)); return (r && Date.now() - r.ts < ttl) ? r.data : null; }
    catch (e) { return null; }
  }

  /* ── API ────────────────────────────────────────────────── */
  function apiFetch(ep, p) {
    var url = new URL(API_BASE + '/' + ep);
    url.searchParams.set('key', API_KEY);
    Object.keys(p || {}).forEach(function (k) { url.searchParams.set(k, p[k]); });
    return fetch(url.toString()).then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); });
  }

  /* ── Channel Info ──────────────────────────────────────── */
  function fetchChannelInfo() {
    var ck = 'ch_' + CHANNEL_ID, c = getCache(ck, CACHE_TTL.subs);
    if (c) return Promise.resolve(c);
    return apiFetch('channels', { part: 'statistics,snippet', id: CHANNEL_ID }).then(function (d) {
      var ch = d.items && d.items[0]; if (!ch) return null;
      var info = {
        subs:  parseInt(ch.statistics.subscriberCount || 0),
        desc:  ch.snippet.description || '',
        thumb: ((ch.snippet.thumbnails.high || ch.snippet.thumbnails.medium || ch.snippet.thumbnails.default) || {}).url || '',
      };
      setCache(ck, info); return info;
    });
  }

  /* ── Videos page ───────────────────────────────────────── */
  function fetchVideosPage(token, max) {
    var p = { part: 'snippet', channelId: CHANNEL_ID, order: 'date', type: 'video', maxResults: max || PAGE_SIZE };
    if (token) p.pageToken = token;
    return apiFetch('search', p);
  }

  /* ── All videos ────────────────────────────────────────── */
  function fetchAllVideos() {
    var ck = 'allv_' + CHANNEL_ID, c = getCache(ck, CACHE_TTL.videos);
    if (c) return Promise.resolve(c);
    var all = [];
    function next(t) {
      return fetchVideosPage(t, 50).then(function (d) {
        all = all.concat(d.items || []);
        if (d.nextPageToken) return next(d.nextPageToken);
        setCache(ck, all); return all;
      });
    }
    return next(null);
  }

  /* ── Video Stats (likes, views, comments) ─────────────── */
  function fetchVideoStats(ids) {
    if (!ids || !ids.length) return Promise.resolve({});
    var ck = 'vs_' + ids[0] + ids.length, c = getCache(ck, CACHE_TTL.stats);
    if (c) return Promise.resolve(c);
    var batches = [];
    for (var i = 0; i < ids.length; i += 50) batches.push(ids.slice(i, i + 50));
    return Promise.all(batches.map(function (b) {
      return apiFetch('videos', { part: 'statistics,contentDetails', id: b.join(',') }).then(function (d) { return d.items || []; });
    })).then(function (results) {
      var map = {};
      [].concat.apply([], results).forEach(function (item) {
        map[item.id] = {
          likes:    parseInt((item.statistics || {}).likeCount    || 0),
          views:    parseInt((item.statistics || {}).viewCount    || 0),
          comments: parseInt((item.statistics || {}).commentCount || 0),
          duration: (item.contentDetails || {}).duration || '',
        };
      });
      setCache(ck, map); return map;
    });
  }

  /* ── Video Details (contentDetails) ───────────────────── */
  function fetchVideoDetails(ids) {
    if (!ids || !ids.length) return Promise.resolve([]);
    var batches = [];
    for (var i = 0; i < ids.length; i += 50) batches.push(ids.slice(i, i + 50));
    return Promise.all(batches.map(function (b) {
      return apiFetch('videos', { part: 'contentDetails,statistics', id: b.join(',') }).then(function (d) { return d.items || []; });
    })).then(function (r) { return [].concat.apply([], r); });
  }

  /* ── Playlists ─────────────────────────────────────────── */
  function fetchPlaylists() {
    var ck = 'pl_' + CHANNEL_ID, c = getCache(ck, CACHE_TTL.playlists);
    if (c) return Promise.resolve(c);
    var all = [];
    function next(t) {
      var p = { part: 'snippet,contentDetails', channelId: CHANNEL_ID, maxResults: 50 };
      if (t) p.pageToken = t;
      return apiFetch('playlists', p).then(function (d) {
        all = all.concat(d.items || []);
        if (d.nextPageToken) return next(d.nextPageToken);
        setCache(ck, all); return all;
      });
    }
    return next(null);
  }

  /* ── RSS Fallback ──────────────────────────────────────── */
  function fetchRSS() {
    return fetch(RSS_PROXY + encodeURIComponent('https://www.youtube.com/feeds/videos.xml?channel_id=' + CHANNEL_ID))
      .then(function (r) { return r.text(); })
      .then(function (t) {
        var xml = new DOMParser().parseFromString(t, 'application/xml');
        return Array.from(xml.querySelectorAll('entry')).map(function (e) {
          var vid = (e.querySelector('videoId') || {}).textContent || '';
          return { id: { videoId: vid }, snippet: { title: ((e.querySelector('title') || {}).textContent || ''), publishedAt: ((e.querySelector('published') || {}).textContent || '') } };
        });
      });
  }

  /* ── Helpers ───────────────────────────────────────────── */
  function thumbMQ(id) { return 'https://i.ytimg.com/vi/' + id + '/mqdefault.jpg'; }
  function thumbHQ(id) { return 'https://i.ytimg.com/vi/' + id + '/maxresdefault.jpg'; }
  function formatNum(n) {
    n = parseInt(n); if (isNaN(n)) return '0';
    if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
    if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
    return n.toLocaleString();
  }
  function formatDate(iso) {
    return iso ? new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '';
  }

  /* ── Lazy images (opacity fade, no blur glitch) ────────── */
  function observeImages() {
    // For images already cached/complete, mark them immediately
    document.querySelectorAll('img[data-src], img[src]').forEach(function (img) {
      if (img.complete && img.naturalWidth > 0) img.classList.add('loaded');
    });

    if (!('IntersectionObserver' in window)) {
      document.querySelectorAll('img[data-src]').forEach(function (img) {
        img.src = img.dataset.src || img.src;
        if (img.complete && img.naturalWidth > 0) img.classList.add('loaded');
        else img.onload = function () { img.classList.add('loaded'); };
      });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        var img = entry.target;
        var hq  = img.dataset.hq;
        var src = img.dataset.src || img.getAttribute('src');
        function markLoaded() { img.classList.add('loaded'); }
        if (hq) {
          // load HQ, fall back to MQ if HQ 404s
          var loader = new Image();
          loader.onload  = function () { img.src = hq; markLoaded(); };
          loader.onerror = function () { img.src = src; markLoaded(); };
          loader.src = hq;
        } else if (src) {
          if (img.complete && img.naturalWidth > 0) { markLoaded(); }
          else { img.src = src; img.onload = markLoaded; img.onerror = markLoaded; }
        }
        io.unobserve(img);
      });
    }, { rootMargin: '300px' });

    document.querySelectorAll('img[data-src], .thumb-wrap img:not(.loaded)').forEach(function (img) {
      if (img.complete && img.naturalWidth > 0) { img.classList.add('loaded'); }
      else { io.observe(img); }
    });
  }

  /* ── Build Video Card with stats ───────────────────────── */
  function buildVideoCard(item, stats) {
    var vid   = (item.id && item.id.videoId) || '';
    var title = (item.snippet && item.snippet.title) || '';
    var date  = formatDate(item.snippet && item.snippet.publishedAt);
    var esc   = title.replace(/"/g, '&quot;').replace(/</g, '&lt;');
    var st    = (stats && stats[vid]) || null;

    var statsHtml = '';
    if (st) {
      statsHtml =
        '<div class="video-stats">' +
          '<span class="stat-pill"><span class="s-icon">&#128065;</span>' + formatNum(st.views)    + '</span>' +
          '<span class="stat-pill stat-like"><span class="s-icon">&#10084;</span>' + formatNum(st.likes)    + '</span>' +
          '<span class="stat-pill"><span class="s-icon">&#128172;</span>' + formatNum(st.comments) + '</span>' +
        '</div>';
    } else {
      statsHtml = '<div class="video-stats video-stats-loading"><span class="stat-skeleton"></span><span class="stat-skeleton"></span><span class="stat-skeleton"></span></div>';
    }

    return '<a href="watch.html?id=' + vid + '" class="video-card fade-up" aria-label="' + esc + '">' +
      '<div class="thumb-wrap">' +
        '<img data-src="' + thumbMQ(vid) + '" data-hq="' + thumbHQ(vid) + '" src="' + thumbMQ(vid) + '" alt="' + esc + '" loading="lazy" />' +
        '<div class="thumb-overlay"><div class="play-btn">&#9654;</div></div>' +
      '</div>' +
      '<div class="video-info">' +
        '<div class="video-title">' + title + '</div>' +
        '<div class="video-meta">' + date + '</div>' +
        statsHtml +
      '</div></a>';
  }

  /* ── Build Trending Card ───────────────────────────────── */
  function buildTrendingCard(item, num, stats) {
    var vid   = (item.id && item.id.videoId) || '';
    var title = (item.snippet && item.snippet.title) || '';
    var esc   = title.replace(/"/g, '&quot;').replace(/</g, '&lt;');
    var st    = (stats && stats[vid]) || null;
    var tStats = st ? '<div class="trending-stats"><span>&#128065; ' + formatNum(st.views) + '</span><span>&#10084; ' + formatNum(st.likes) + '</span></div>' : '';
    return '<a href="watch.html?id=' + vid + '" class="trending-card fade-up" style="animation-delay:' + (num * 0.08) + 's" aria-label="' + esc + '">' +
      '<img data-src="' + thumbMQ(vid) + '" data-hq="' + thumbHQ(vid) + '" src="' + thumbMQ(vid) + '" alt="' + esc + '" loading="lazy" />' +
      '<div class="trending-overlay"><div class="trending-num">0' + (num + 1) + '</div><div class="trending-title">' + title + '</div>' + tStats + '</div></a>';
  }

  /* ── Animated counter ──────────────────────────────────── */
  function animateCount(el, target, suffix) {
    var start = performance.now(), dur = 1800;
    function step(now) {
      var p = Math.min((now - start) / dur, 1), e = 1 - Math.pow(1 - p, 3);
      el.textContent = formatNum(Math.floor(e * target)) + (suffix || '');
      if (p < 1) requestAnimationFrame(step); else el.textContent = formatNum(target) + (suffix || '');
    }
    requestAnimationFrame(step);
  }

  /* ── Mobile nav ────────────────────────────────────────── */
  function initMobileNav() {
    var btn = document.getElementById('hamburger'), ov = document.getElementById('nav-overlay'), cb = document.getElementById('nav-close');
    if (!btn || !ov) return;
    function open()  { ov.classList.add('open'); btn.setAttribute('aria-expanded', 'true'); ov.removeAttribute('aria-hidden'); }
    function close() { ov.classList.remove('open'); btn.setAttribute('aria-expanded', 'false'); ov.setAttribute('aria-hidden', 'true'); }
    btn.addEventListener('click', open);
    if (cb) cb.addEventListener('click', close);
    ov.addEventListener('click', function (e) { if (e.target === ov) close(); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') close(); });
  }

  /* ── Highlight nav ─────────────────────────────────────── */
  function highlightNav() {
    var page = location.pathname.split('/').pop() || 'index.html';
    document.querySelectorAll('.nav-link').forEach(function (l) {
      var href = l.getAttribute('href') || '';
      l.classList.toggle('active', href === page || (page === 'index.html' && href === 'index.html'));
    });
  }

  /* ── HOME ──────────────────────────────────────────────── */
  function initHomePage() {
    var grid = document.getElementById('home-grid'), trending = document.getElementById('trending-grid'), subEl = document.getElementById('sub-count');

    if (subEl) {
      fetchChannelInfo().then(function (info) {
        if (!info) { subEl.textContent = 'Subscribe'; return; }
        animateCount(subEl, info.subs, ' subscribers');
        if (info.thumb) document.querySelectorAll('.sidebar-logo,.hero-avatar').forEach(function (img) { img.src = info.thumb; });
      }).catch(function () { if (subEl) subEl.textContent = 'Subscribe'; });
    }

    fetchVideosPage(null, PAGE_SIZE).then(function (data) {
      var items = data.items || [];
      var ids = items.map(function (v) { return (v.id && v.id.videoId) || ''; }).filter(Boolean);
      // render skeleton stats first
      if (grid) { grid.innerHTML = items.map(function (i) { return buildVideoCard(i, null); }).join(''); observeImages(); setTimeout(observeImages, 120); }
      if (trending) { trending.innerHTML = items.slice(0, 3).map(function (v, i) { return buildTrendingCard(v, i, null); }).join(''); observeImages(); setTimeout(observeImages, 120); }
      initHomeSearch(items, grid, null);
      // then fetch real stats and re-render
      fetchVideoStats(ids).then(function (stats) {
        if (grid) { grid.innerHTML = items.map(function (i) { return buildVideoCard(i, stats); }).join(''); observeImages(); initHomeSearch(items, grid, stats); }
        if (trending) { trending.innerHTML = items.slice(0, 3).map(function (v, i) { return buildTrendingCard(v, i, stats); }).join(''); observeImages(); }
      }).catch(function () {});
    }).catch(function (err) {
      console.warn('Home API failed, RSS fallback…', err);
      fetchRSS().then(function (items) {
        if (grid) { grid.innerHTML = items.slice(0, PAGE_SIZE).map(function (i) { return buildVideoCard(i, null); }).join(''); observeImages(); initHomeSearch(items, grid, null); }
        if (trending) { trending.innerHTML = items.slice(0, 3).map(function (v, i) { return buildTrendingCard(v, i, null); }).join(''); observeImages(); }
      }).catch(function () { if (grid) grid.innerHTML = '<div class="empty-state"><div class="empty-icon">&#128225;</div>Could not load videos.</div>'; });
    });
  }

  function initHomeSearch(items, grid, stats) {
    var input = document.getElementById('search-input');
    if (!input || !grid) return;
    var fresh = input.cloneNode(true); input.parentNode.replaceChild(fresh, input);
    var timer;
    fresh.addEventListener('input', function () {
      clearTimeout(timer);
      timer = setTimeout(function () {
        var q = fresh.value.trim().toLowerCase();
        if (!q) { grid.innerHTML = items.map(function (i) { return buildVideoCard(i, stats); }).join(''); observeImages(); return; }
        var f = items.filter(function (v) { return ((v.snippet && v.snippet.title) || '').toLowerCase().indexOf(q) !== -1; });
        grid.innerHTML = f.length ? f.map(function (i) { return buildVideoCard(i, stats); }).join('') : '<div class="empty-state"><div class="empty-icon">&#128269;</div>No videos found.</div>';
        observeImages();
      }, 280);
    });
  }

  /* ── VIDEOS PAGE ───────────────────────────────────────── */
  var _vToken = null, _vLoad = false, _vItems = [];
  function initVideosPage() {
    var grid = document.getElementById('videos-grid'), btn = document.getElementById('load-more-btn'), srch = document.getElementById('videos-search');
    if (!grid) return;

    function loadChunk() {
      if (_vLoad) return; _vLoad = true;
      if (btn) { btn.disabled = true; btn.textContent = 'Loading…'; }
      fetchVideosPage(_vToken, PAGE_SIZE).then(function (data) {
        var items = data.items || [];
        _vToken = data.nextPageToken || null;
        _vItems = _vItems.concat(items);
        // render with skeleton stats
        var frag = document.createDocumentFragment(), tmp = document.createElement('div');
        tmp.innerHTML = items.map(function (i) { return buildVideoCard(i, null); }).join('');
        while (tmp.firstChild) frag.appendChild(tmp.firstChild);
        grid.appendChild(frag); observeImages();
        // enrich with real stats
        var ids = items.map(function (v) { return (v.id && v.id.videoId) || ''; }).filter(Boolean);
        fetchVideoStats(ids).then(function (stats) {
          var cards = grid.querySelectorAll('.video-card'), offset = cards.length - items.length;
          items.forEach(function (item, i) {
            var card = cards[offset + i]; if (!card) return;
            var t = document.createElement('div');
            t.innerHTML = buildVideoCard(item, stats);
            grid.replaceChild(t.firstChild, card);
          });
          observeImages();
        }).catch(function () {});
        if (!_vToken) { if (btn) btn.style.display = 'none'; }
        else { if (btn) { btn.disabled = false; btn.textContent = 'Load More'; } }
      }).catch(function () { if (btn) { btn.disabled = false; btn.textContent = 'Retry'; } })
        .then(function () { _vLoad = false; });
    }

    loadChunk();
    if (btn) btn.addEventListener('click', loadChunk);
    if (srch) {
      var timer;
      srch.addEventListener('input', function () {
        clearTimeout(timer);
        timer = setTimeout(function () {
          var q = srch.value.trim().toLowerCase();
          grid.querySelectorAll('.video-card').forEach(function (c) {
            var t = ((c.querySelector('.video-title') || {}).textContent || '').toLowerCase();
            c.style.display = t.indexOf(q) !== -1 ? '' : 'none';
          });
          if (btn) btn.style.display = q ? 'none' : (_vToken ? '' : 'none');
        }, 280);
      });
    }
  }

  /* ── WATCH PAGE ────────────────────────────────────────── */
  function initWatchPage() {
    var videoId = new URLSearchParams(location.search).get('id');
    var playerEl = document.getElementById('watch-player');
    if (!videoId) { if (playerEl) playerEl.innerHTML = '<div class="empty-state">No video specified.</div>'; return; }

    if (playerEl) {
      playerEl.innerHTML = '<iframe src="https://www.youtube.com/embed/' + videoId + '?autoplay=0&rel=0" title="Video player" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>';
    }

    apiFetch('videos', { part: 'snippet,statistics', id: videoId }).then(function (data) {
      var item = data.items && data.items[0]; if (!item) return;
      var titleEl = document.getElementById('watch-title'), metaEl = document.getElementById('watch-meta'), statsEl = document.getElementById('watch-stats');
      if (titleEl) titleEl.textContent = item.snippet.title;
      document.title = item.snippet.title + ' — Mr. Si!ent';
      if (metaEl) metaEl.textContent = formatNum(item.statistics.viewCount || 0) + ' views · ' + formatDate(item.snippet.publishedAt);
      if (statsEl) {
        statsEl.innerHTML =
          '<span class="watch-stat-pill"><span>&#128065;</span> ' + formatNum(item.statistics.viewCount    || 0) + ' views</span>' +
          '<span class="watch-stat-pill watch-stat-like"><span>&#10084;</span> ' + formatNum(item.statistics.likeCount    || 0) + ' likes</span>' +
          '<span class="watch-stat-pill"><span>&#128172;</span> ' + formatNum(item.statistics.commentCount || 0) + ' comments</span>';
      }
    }).catch(function (e) { console.warn(e); });

    var upEl = document.getElementById('up-next-list');
    if (upEl) {
      fetchVideosPage(null, 8).then(function (data) {
        upEl.innerHTML = (data.items || []).filter(function (v) { return (v.id && v.id.videoId) !== videoId; }).slice(0, 6).map(function (v) {
          var vid = (v.id && v.id.videoId) || '', title = (v.snippet && v.snippet.title) || '', esc = title.replace(/"/g, '&quot;').replace(/</g, '&lt;');
          return '<a href="watch.html?id=' + vid + '" class="up-next-item"><img class="up-next-thumb" src="' + thumbMQ(vid) + '" alt="' + esc + '" loading="lazy" /><div><div class="up-next-title">' + title + '</div><div class="up-next-meta">' + formatDate(v.snippet && v.snippet.publishedAt) + '</div></div></a>';
        }).join('');
      }).catch(function (e) { console.warn(e); });
    }
  }

  /* ── PLAYLISTS PAGE ────────────────────────────────────── */
  function initPlaylistsPage() {
    var grid = document.getElementById('playlists-grid'); if (!grid) return;
    grid.innerHTML = '<div class="spinner-wrap"><div class="spinner"></div></div>';
    fetchPlaylists().then(function (pls) {
      if (!pls.length) { grid.innerHTML = '<div class="empty-state"><div class="empty-icon">&#128194;</div>No public playlists.</div>'; return; }
      grid.innerHTML = pls.map(function (pl) {
        var id = pl.id, title = (pl.snippet && pl.snippet.title) || '', count = (pl.contentDetails && pl.contentDetails.itemCount) || 0, esc = title.replace(/"/g, '&quot;').replace(/</g, '&lt;');
        return '<div class="playlist-card fade-up"><div class="playlist-title">' + title + '</div><div class="playlist-count">&#127916; ' + count + ' video' + (count !== 1 ? 's' : '') + '</div><div class="responsive-embed" style="border-radius:0 0 14px 14px;border-top:none;"><iframe src="https://www.youtube.com/embed/videoseries?list=' + id + '" title="' + esc + '" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen loading="lazy"></iframe></div></div>';
      }).join('');
    }).catch(function (err) { grid.innerHTML = '<div class="empty-state"><div class="empty-icon">&#9888;&#65039;</div>Failed to load playlists.</div>'; console.error(err); });
  }

  /* ── ABOUT PAGE ────────────────────────────────────────── */
  function initAboutPage() {
    fetchChannelInfo().then(function (info) {
      if (!info) return;
      if (info.thumb) document.querySelectorAll('.about-avatar,.sidebar-logo').forEach(function (img) { img.src = info.thumb; });
      var d = document.getElementById('channel-desc'); if (d && info.desc) d.textContent = info.desc;
      var s = document.getElementById('about-sub-count'); if (s) animateCount(s, info.subs, '');
      var s2 = document.getElementById('sub-count'); if (s2) animateCount(s2, info.subs, ' subscribers');
    }).catch(function (e) { console.warn(e); });
  }

  /* ── Expose globals for shorts.js ─────────────────────── */
  window._mrSilent = {
    fetchAllVideos:    fetchAllVideos,
    fetchVideoDetails: fetchVideoDetails,
    fetchVideoStats:   fetchVideoStats,
    thumbMQ:           thumbMQ,
    thumbHQ:           thumbHQ,
    formatNum:         formatNum,
    formatDate:        formatDate,
    observeImages:     observeImages,
    CHANNEL_ID:        CHANNEL_ID,
  };

  /* ── SW Registration ───────────────────────────────────── */
  function registerSW() { if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(function () {}); }

  /* ── Init ──────────────────────────────────────────────── */
  function init() {
    highlightNav(); initMobileNav(); registerSW();
    var page = location.pathname.split('/').pop() || 'index.html';
    if      (page === 'index.html' || page === '') initHomePage();
    else if (page === 'videos.html')               initVideosPage();
    else if (page === 'watch.html')                initWatchPage();
    else if (page === 'playlists.html')            initPlaylistsPage();
    else if (page === 'about.html')                initAboutPage();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
