/* © Mr. Si!ent Creator Hub — All Rights Reserved. */
(function () {
  'use strict';

  /* ─────────────────────────────────────────────────────────
   * CONFIG
   * ───────────────────────────────────────────────────────── */
  var API_KEY    = 'AIzaSyAEBSwFQQHGdg7EdKTWXaBvl6b6cOhFpXc';
  var CHANNEL_ID = window.CHANNEL_ID || 'UCKQ_q75TKeAcYXYeu0uaWlQ';
  var API_BASE   = 'https://www.googleapis.com/youtube/v3';
  var PAGE_SIZE  = 12;

  /* uploads playlist = replace leading 'UC' with 'UU' */
  var UPLOADS_PL = 'UU' + CHANNEL_ID.slice(2);

  var CACHE_TTL = {
    channel:  5  * 60000,   // 5 min
    uploads:  15 * 60000,   // 15 min  (full video list)
    lives:    10 * 60000,   // 10 min  (completed streams)
    stats:    15 * 60000,
  };

  /* ─────────────────────────────────────────────────────────
   * CACHE
   * ───────────────────────────────────────────────────────── */
  function setCache(k, d) {
    try { localStorage.setItem(k, JSON.stringify({ ts: Date.now(), data: d })); } catch (e) {}
  }
  function getCache(k, ttl) {
    try {
      var r = JSON.parse(localStorage.getItem(k));
      return (r && Date.now() - r.ts < ttl) ? r.data : null;
    } catch (e) { return null; }
  }
  function clearCache() {
    try {
      Object.keys(localStorage).forEach(function (k) {
        if (k.indexOf('mrsilent') === 0 || k.indexOf('allup') === 0 ||
            k.indexOf('lives') === 0 || k.indexOf('ch_') === 0) {
          localStorage.removeItem(k);
        }
      });
    } catch (e) {}
  }

  /* ─────────────────────────────────────────────────────────
   * API FETCH
   * ───────────────────────────────────────────────────────── */
  function apiFetch(ep, params) {
    var url = new URL(API_BASE + '/' + ep);
    url.searchParams.set('key', API_KEY);
    Object.keys(params || {}).forEach(function (k) { url.searchParams.set(k, params[k]); });
    return fetch(url.toString()).then(function (r) {
      if (!r.ok) return r.json().then(function (e) { throw new Error((e.error && e.error.message) || r.status); });
      return r.json();
    });
  }

  /* ─────────────────────────────────────────────────────────
   * CHANNEL INFO
   * ───────────────────────────────────────────────────────── */
  function fetchChannelInfo() {
    var ck = 'ch_' + CHANNEL_ID, c = getCache(ck, CACHE_TTL.channel);
    if (c) return Promise.resolve(c);
    return apiFetch('channels', { part: 'statistics,snippet', id: CHANNEL_ID })
      .then(function (d) {
        var ch = d.items && d.items[0];
        if (!ch) return null;
        var info = {
          subs:  parseInt(ch.statistics.subscriberCount || 0),
          desc:  ch.snippet.description || '',
          thumb: ((ch.snippet.thumbnails.high || ch.snippet.thumbnails.medium ||
                   ch.snippet.thumbnails.default) || {}).url || '',
        };
        setCache(ck, info);
        return info;
      });
  }

  /* ─────────────────────────────────────────────────────────
   * UPLOADS PLAYLIST  →  ALL published video IDs
   * No 500-result cap — gets every single public upload.
   * ───────────────────────────────────────────────────────── */
  function fetchAllUploadIds() {
    var all = [];
    function next(token) {
      var p = { part: 'contentDetails', playlistId: UPLOADS_PL, maxResults: 50 };
      if (token) p.pageToken = token;
      return apiFetch('playlistItems', p).then(function (d) {
        (d.items || []).forEach(function (item) {
          var vid = item.contentDetails && item.contentDetails.videoId;
          if (vid) all.push(vid);
        });
        return d.nextPageToken ? next(d.nextPageToken) : all;
      });
    }
    return next(null);
  }

  /* ─────────────────────────────────────────────────────────
   * BATCH VIDEO DETAILS  (snippet + contentDetails + statistics)
   * ───────────────────────────────────────────────────────── */
  function fetchVideosBatch(ids) {
    if (!ids || !ids.length) return Promise.resolve([]);
    var batches = [];
    for (var i = 0; i < ids.length; i += 50) batches.push(ids.slice(i, i + 50));
    return Promise.all(batches.map(function (b) {
      return apiFetch('videos', {
        part: 'snippet,contentDetails,statistics',
        id:   b.join(','),
      }).then(function (d) { return d.items || []; });
    })).then(function (results) {
      return [].concat.apply([], results);
    });
  }

  /* ─────────────────────────────────────────────────────────
   * FETCH ALL UPLOADS WITH FULL DETAILS
   * ───────────────────────────────────────────────────────── */
  function fetchAllUploads() {
    var ck = 'allup_' + CHANNEL_ID, c = getCache(ck, CACHE_TTL.uploads);
    if (c) return Promise.resolve(c);

    return fetchAllUploadIds().then(function (ids) {
      return fetchVideosBatch(ids);
    }).then(function (videos) {
      /* filter deleted / private */
      var valid = videos.filter(function (v) {
        var t = v.snippet && v.snippet.title;
        return t && t !== 'Deleted video' && t !== 'Private video';
      });
      setCache(ck, valid);
      return valid;
    });
  }

  /* ─────────────────────────────────────────────────────────
   * COMPLETED LIVE STREAMS  (search API, eventType=completed)
   * ───────────────────────────────────────────────────────── */
  function fetchCompletedLives() {
    var ck = 'lives_' + CHANNEL_ID, c = getCache(ck, CACHE_TTL.lives);
    if (c) return Promise.resolve(c);

    var all = [];
    function next(token) {
      var p = {
        part:      'snippet',
        channelId: CHANNEL_ID,
        type:      'video',
        eventType: 'completed',
        order:     'date',
        maxResults: 50,
      };
      if (token) p.pageToken = token;
      return apiFetch('search', p).then(function (d) {
        all = all.concat(d.items || []);
        return d.nextPageToken ? next(d.nextPageToken) : all;
      });
    }

    return next(null).then(function (items) {
      /* build a set of live video IDs */
      var ids = {};
      items.forEach(function (item) {
        var vid = item.id && item.id.videoId;
        if (vid) ids[vid] = true;
      });
      var result = { items: items, ids: ids };
      setCache(ck, result);
      return result;
    }).catch(function () {
      return { items: [], ids: {} };
    });
  }

  /* ─────────────────────────────────────────────────────────
   * CURRENT LIVE  (search API, eventType=live)
   * ───────────────────────────────────────────────────────── */
  function fetchCurrentLive() {
    return apiFetch('search', {
      part: 'snippet', channelId: CHANNEL_ID, type: 'video',
      eventType: 'live', maxResults: 5,
    }).then(function (d) { return d.items || []; })
      .catch(function () { return []; });
  }

  /* ─────────────────────────────────────────────────────────
   * HELPERS
   * ───────────────────────────────────────────────────────── */
  function parseDuration(iso) {
    if (!iso) return 0;
    var m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
    if (!m) return 0;
    return (parseInt(m[1] || 0) * 3600) +
           (parseInt(m[2] || 0) * 60)   +
           parseInt(m[3] || 0);
  }

  function thumbMQ(id) { return 'https://i.ytimg.com/vi/' + id + '/mqdefault.jpg'; }
  function thumbHQ(id) { return 'https://i.ytimg.com/vi/' + id + '/maxresdefault.jpg'; }

  function formatNum(n) {
    n = parseInt(n); if (isNaN(n)) return '0';
    if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
    if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
    return n.toLocaleString();
  }
  function formatDate(iso) {
    return iso ? new Date(iso).toLocaleDateString('en-US',
      { month: 'short', day: 'numeric', year: 'numeric' }) : '';
  }
  function formatDuration(iso) {
    var s = parseDuration(iso);
    if (!s) return '';
    var h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
    if (h) return h + ':' + pad(m) + ':' + pad(sec);
    return m + ':' + pad(sec);
  }
  function pad(n) { return n < 10 ? '0' + n : '' + n; }

  /* Convert full video object → card-compatible item */
  function toItem(v) {
    return {
      id:      { videoId: v.id },
      snippet: v.snippet,
      _stats:  v.statistics || {},
      _dur:    parseDuration(v.contentDetails && v.contentDetails.duration),
      _durIso: v.contentDetails && v.contentDetails.duration,
    };
  }

  /* Build a stats map from fetchAllUploads results */
  function buildStatsMap(videos) {
    var map = {};
    videos.forEach(function (v) {
      var st = v.statistics || {};
      map[v.id] = {
        likes:    parseInt(st.likeCount    || 0),
        views:    parseInt(st.viewCount    || 0),
        comments: parseInt(st.commentCount || 0),
      };
    });
    return map;
  }

  /* ─────────────────────────────────────────────────────────
   * LAZY IMAGE LOADING  (opacity fade — no blur glitch)
   * ───────────────────────────────────────────────────────── */
  function observeImages() {
    document.querySelectorAll('img[src]').forEach(function (img) {
      if (img.complete && img.naturalWidth > 0) img.classList.add('loaded');
    });
    if (!('IntersectionObserver' in window)) {
      document.querySelectorAll('img[data-src]').forEach(function (img) {
        img.src = img.dataset.src;
        if (img.complete && img.naturalWidth > 0) img.classList.add('loaded');
        else img.onload = function () { img.classList.add('loaded'); };
      });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        var img = entry.target, hq = img.dataset.hq, src = img.dataset.src || img.src;
        function done() { img.classList.add('loaded'); }
        if (img.complete && img.naturalWidth > 0) { done(); io.unobserve(img); return; }
        if (hq) {
          var l = new Image();
          l.onload  = function () { img.src = hq; done(); };
          l.onerror = function () { if (src) img.src = src; done(); };
          l.src = hq;
        } else if (src) {
          img.src = src;
          img.onload  = done;
          img.onerror = done;
        }
        io.unobserve(img);
      });
    }, { rootMargin: '300px' });
    document.querySelectorAll('img[data-src], .thumb-wrap img:not(.loaded)').forEach(function (img) {
      if (img.complete && img.naturalWidth > 0) img.classList.add('loaded');
      else io.observe(img);
    });
  }

  /* ─────────────────────────────────────────────────────────
   * BUILD VIDEO CARD  (regular + live-past)
   * ───────────────────────────────────────────────────────── */
  function buildVideoCard(item, stats, opts) {
    opts = opts || {};
    var vid   = (item.id && item.id.videoId) || '';
    var title = (item.snippet && item.snippet.title) || '';
    var date  = formatDate(item.snippet && item.snippet.publishedAt);
    var esc   = title.replace(/"/g, '&quot;').replace(/</g, '&lt;');
    var dur   = item._durIso ? formatDuration(item._durIso) : '';
    var st    = (stats && stats[vid]) || (item._stats) || null;

    var statsHtml = '';
    if (st && (st.views !== undefined)) {
      statsHtml =
        '<div class="video-stats">' +
          '<span class="stat-pill"><span class="s-icon">&#128065;</span>' + formatNum(st.views)    + '</span>' +
          '<span class="stat-pill stat-like"><span class="s-icon">&#10084;</span>'  + formatNum(st.likes)    + '</span>' +
          '<span class="stat-pill"><span class="s-icon">&#128172;</span>' + formatNum(st.comments) + '</span>' +
        '</div>';
    } else {
      statsHtml = '<div class="video-stats video-stats-loading"><span class="stat-skeleton"></span><span class="stat-skeleton"></span><span class="stat-skeleton"></span></div>';
    }

    var durBadge = dur ? '<span class="dur-badge">' + dur + '</span>' : '';
    var liveBadge = opts.isLive ? '<span class="live-thumb-badge"><span class="live-dot"></span>LIVE</span>' : '';
    var pastBadge = opts.isPast ? '<span class="past-live-badge">&#128247; Live VOD</span>' : '';

    return '<a href="watch.html?id=' + vid + '" class="video-card fade-up" aria-label="' + esc + '">' +
      '<div class="thumb-wrap">' +
        '<img data-src="' + thumbMQ(vid) + '" data-hq="' + thumbHQ(vid) + '"' +
             ' src="' + thumbMQ(vid) + '" alt="' + esc + '" loading="lazy" />' +
        '<div class="thumb-overlay"><div class="play-btn">&#9654;</div></div>' +
        durBadge + liveBadge + pastBadge +
      '</div>' +
      '<div class="video-info">' +
        '<div class="video-title">' + title + '</div>' +
        '<div class="video-meta">' + date + '</div>' +
        statsHtml +
      '</div></a>';
  }

  /* ─────────────────────────────────────────────────────────
   * BUILD TRENDING CARD
   * ───────────────────────────────────────────────────────── */
  function buildTrendingCard(item, num) {
    var vid   = (item.id && item.id.videoId) || '';
    var title = (item.snippet && item.snippet.title) || '';
    var esc   = title.replace(/"/g, '&quot;').replace(/</g, '&lt;');
    var st    = item._stats || {};
    var tStats = (st.views !== undefined)
      ? '<div class="trending-stats"><span>&#128065; ' + formatNum(st.views) + '</span>' +
        '<span>&#10084; ' + formatNum(st.likes) + '</span></div>'
      : '';
    return '<a href="watch.html?id=' + vid + '" class="trending-card fade-up"' +
           ' style="animation-delay:' + (num * 0.08) + 's" aria-label="' + esc + '">' +
      '<img data-src="' + thumbMQ(vid) + '" data-hq="' + thumbHQ(vid) + '"' +
           ' src="' + thumbMQ(vid) + '" alt="' + esc + '" loading="lazy" />' +
      '<div class="trending-overlay">' +
        '<div class="trending-num">0' + (num + 1) + '</div>' +
        '<div class="trending-title">' + title + '</div>' + tStats +
      '</div></a>';
  }

  /* ─────────────────────────────────────────────────────────
   * ANIMATED COUNTER
   * ───────────────────────────────────────────────────────── */
  function animateCount(el, target, suffix) {
    var start = performance.now(), dur = 1800;
    function step(now) {
      var p = Math.min((now - start) / dur, 1), e = 1 - Math.pow(1 - p, 3);
      el.textContent = formatNum(Math.floor(e * target)) + (suffix || '');
      if (p < 1) requestAnimationFrame(step);
      else el.textContent = formatNum(target) + (suffix || '');
    }
    requestAnimationFrame(step);
  }

  /* ─────────────────────────────────────────────────────────
   * MOBILE NAV
   * ───────────────────────────────────────────────────────── */
  function initMobileNav() {
    var btn = document.getElementById('hamburger'),
        ov  = document.getElementById('nav-overlay'),
        cb  = document.getElementById('nav-close');
    if (!btn || !ov) return;
    function open()  { ov.classList.add('open'); btn.setAttribute('aria-expanded','true'); ov.removeAttribute('aria-hidden'); }
    function close() { ov.classList.remove('open'); btn.setAttribute('aria-expanded','false'); ov.setAttribute('aria-hidden','true'); }
    btn.addEventListener('click', open);
    if (cb) cb.addEventListener('click', close);
    ov.addEventListener('click', function (e) { if (e.target === ov) close(); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') close(); });
  }

  /* ─────────────────────────────────────────────────────────
   * HIGHLIGHT ACTIVE NAV
   * ───────────────────────────────────────────────────────── */
  function highlightNav() {
    var page = location.pathname.split('/').pop() || 'index.html';
    document.querySelectorAll('.nav-link').forEach(function (l) {
      var href = l.getAttribute('href') || '';
      l.classList.toggle('active', href === page ||
        (page === 'index.html' && href === 'index.html') ||
        (page === '' && href === 'index.html'));
    });
  }

  /* ─────────────────────────────────────────────────────────
   * CLIENT-SIDE PAGINATOR
   * items = array of all cards HTML strings
   * ───────────────────────────────────────────────────────── */
  function paginator(grid, btn, items, pageSize) {
    var offset = 0;
    function show() {
      var chunk = items.slice(offset, offset + pageSize);
      var frag = document.createDocumentFragment(), tmp = document.createElement('div');
      tmp.innerHTML = chunk.join('');
      while (tmp.firstChild) frag.appendChild(tmp.firstChild);
      grid.appendChild(frag);
      observeImages(); setTimeout(observeImages, 120);
      offset += chunk.length;
      if (btn) {
        btn.style.display = offset >= items.length ? 'none' : '';
        btn.disabled = false;
        btn.textContent = 'Load More (' + (items.length - offset) + ' remaining)';
      }
    }
    // initial load
    grid.innerHTML = '';
    if (!items.length) {
      grid.innerHTML = '<div class="empty-state"><div class="empty-icon">&#128225;</div>No videos found.</div>';
      if (btn) btn.style.display = 'none';
      return;
    }
    show();
    if (btn) {
      btn.addEventListener('click', function () { btn.disabled = true; btn.textContent = 'Loading…'; show(); });
    }
  }

  /* ─────────────────────────────────────────────────────────
   * HOME PAGE
   * ───────────────────────────────────────────────────────── */
  function initHomePage() {
    var grid     = document.getElementById('home-grid');
    var trending = document.getElementById('trending-grid');
    var subEl    = document.getElementById('sub-count');

    if (subEl) {
      fetchChannelInfo().then(function (info) {
        if (!info) { subEl.textContent = 'Subscribe'; return; }
        animateCount(subEl, info.subs, ' subscribers');
        if (info.thumb) {
          document.querySelectorAll('.sidebar-logo,.hero-avatar').forEach(function (img) { img.src = info.thumb; });
        }
      }).catch(function () { if (subEl) subEl.textContent = 'Subscribe'; });
    }

    if (!grid && !trending) return;

    /* Fetch all uploads, filter out lives, show latest regular + shorts mix on home */
    fetchAllUploads().then(function (videos) {
      return fetchCompletedLives().then(function (livesData) {
        var liveIds = livesData.ids || {};
        /* regular videos = not live AND duration > 60s */
        var regular = videos.filter(function (v) {
          return !liveIds[v.id] && parseDuration((v.contentDetails || {}).duration) > 60;
        }).map(toItem);

        var statsMap = buildStatsMap(videos);

        if (trending) {
          trending.innerHTML = regular.slice(0, 3).map(function (v, i) { return buildTrendingCard(v, i); }).join('');
          observeImages(); setTimeout(observeImages, 120);
        }

        if (grid) {
          grid.innerHTML = regular.slice(0, PAGE_SIZE).map(function (v) { return buildVideoCard(v, statsMap); }).join('');
          observeImages(); setTimeout(observeImages, 120);
          initHomeSearch(regular, grid, statsMap);
        }
      });
    }).catch(function (err) {
      console.error('Home fetch failed:', err);
      /* RSS fallback for home */
      fetchRSS().then(function (items) {
        if (grid) {
          grid.innerHTML = items.slice(0, PAGE_SIZE).map(function (i) { return buildVideoCard(i, null); }).join('');
          observeImages();
          initHomeSearch(items, grid, null);
        }
        if (trending) {
          trending.innerHTML = items.slice(0, 3).map(function (v, i) { return buildTrendingCard(v, i); }).join('');
          observeImages();
        }
      }).catch(function () {
        if (grid) grid.innerHTML = '<div class="empty-state"><div class="empty-icon">&#128225;</div>Could not load videos.</div>';
      });
    });
  }

  function initHomeSearch(items, grid, statsMap) {
    var input = document.getElementById('search-input');
    if (!input || !grid) return;
    var fresh = input.cloneNode(true);
    input.parentNode.replaceChild(fresh, input);
    var timer;
    fresh.addEventListener('input', function () {
      clearTimeout(timer);
      timer = setTimeout(function () {
        var q = fresh.value.trim().toLowerCase();
        if (!q) {
          grid.innerHTML = items.slice(0, PAGE_SIZE).map(function (i) { return buildVideoCard(i, statsMap); }).join('');
          observeImages(); return;
        }
        var f = items.filter(function (v) {
          return ((v.snippet && v.snippet.title) || '').toLowerCase().indexOf(q) !== -1;
        });
        grid.innerHTML = f.length
          ? f.slice(0, 24).map(function (i) { return buildVideoCard(i, statsMap); }).join('')
          : '<div class="empty-state"><div class="empty-icon">&#128269;</div>No videos found.</div>';
        observeImages();
      }, 280);
    });
  }

  /* ─────────────────────────────────────────────────────────
   * VIDEOS PAGE  — ALL regular videos (no shorts, no lives)
   * ───────────────────────────────────────────────────────── */
  function initVideosPage() {
    var grid = document.getElementById('videos-grid');
    var btn  = document.getElementById('load-more-btn');
    var srch = document.getElementById('videos-search');
    if (!grid) return;

    grid.innerHTML = '<div class="spinner-wrap"><div class="spinner"></div></div>';
    if (btn) btn.style.display = 'none';

    fetchAllUploads().then(function (videos) {
      return fetchCompletedLives().then(function (livesData) {
        var liveIds = livesData.ids || {};
        var statsMap = buildStatsMap(videos);

        /* regular videos: not live, duration > 60s */
        var regular = videos.filter(function (v) {
          return !liveIds[v.id] && parseDuration((v.contentDetails || {}).duration) > 60;
        }).map(toItem);

        grid.innerHTML = '';
        var allHtml = regular.map(function (v) { return buildVideoCard(v, statsMap); });
        paginator(grid, btn, allHtml, PAGE_SIZE);

        /* update count label */
        var countEl = document.getElementById('videos-count');
        if (countEl) countEl.textContent = regular.length + ' videos';

        /* search filter */
        if (srch) {
          var timer;
          srch.addEventListener('input', function () {
            clearTimeout(timer);
            timer = setTimeout(function () {
              var q = srch.value.trim().toLowerCase();
              var filtered = q
                ? regular.filter(function (v) {
                    return ((v.snippet && v.snippet.title) || '').toLowerCase().indexOf(q) !== -1;
                  })
                : regular;
              grid.innerHTML = '';
              if (btn) { btn.style.display = 'none'; btn.replaceWith(btn.cloneNode(true)); btn = document.getElementById('load-more-btn'); }
              var filteredHtml = filtered.map(function (v) { return buildVideoCard(v, statsMap); });
              paginator(grid, btn, filteredHtml, PAGE_SIZE);
            }, 280);
          });
        }
      });
    }).catch(function (err) {
      console.error(err);
      grid.innerHTML = '<div class="empty-state"><div class="empty-icon">&#9888;&#65039;</div>Failed to load videos. Check your internet connection.</div>';
    });
  }

  /* ─────────────────────────────────────────────────────────
   * LIVE PAGE  — current live embed + ALL past live streams
   * ───────────────────────────────────────────────────────── */
  function initLivePage() {
    var liveStatusEl = document.getElementById('live-status');
    var livePlayerEl = document.getElementById('live-player-wrap');
    var pastGridEl   = document.getElementById('past-lives-grid');
    var pastCountEl  = document.getElementById('past-lives-count');

    /* ── Check for active live ── */
    fetchCurrentLive().then(function (liveItems) {
      if (liveItems.length > 0) {
        var vid = liveItems[0].id && liveItems[0].id.videoId;
        if (liveStatusEl) {
          liveStatusEl.innerHTML =
            '<div class="live-badge"><span class="live-dot"></span> LIVE NOW</div>' +
            '<p class="page-subtitle">Mr. Si!ent is streaming live right now!</p>';
        }
        if (livePlayerEl) {
          livePlayerEl.innerHTML =
            '<div class="responsive-embed" style="max-width:900px;">' +
              '<iframe src="https://www.youtube.com/embed/' + vid +
                '?autoplay=0" title="Mr. Si!ent Live" ' +
                'allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"' +
                ' allowfullscreen></iframe>' +
            '</div>';
        }
      } else {
        if (liveStatusEl) {
          liveStatusEl.innerHTML =
            '<div class="live-badge live-badge-offline"><span class="offline-dot"></span> OFFLINE</div>' +
            '<p class="page-subtitle">Not currently live. Check back later or watch past streams below.</p>';
        }
        if (livePlayerEl) {
          livePlayerEl.innerHTML =
            '<div class="live-offline-card">' +
              '<div style="font-size:3rem;margin-bottom:16px;">&#128247;</div>' +
              '<p>No active broadcast right now.</p>' +
              '<a href="https://www.youtube.com/channel/' + CHANNEL_ID + '?sub_confirmation=1" ' +
                 'target="_blank" rel="noopener noreferrer" class="sub-btn">' +
                '&#128276; Subscribe to get notified' +
              '</a>' +
            '</div>';
        }
      }
    }).catch(function () {
      if (liveStatusEl) liveStatusEl.innerHTML = '<p class="page-subtitle">Could not check live status.</p>';
    });

    /* ── Past live streams grid ── */
    if (!pastGridEl) return;
    pastGridEl.innerHTML = '<div class="spinner-wrap"><div class="spinner"></div></div>';

    Promise.all([fetchCompletedLives(), fetchAllUploads()]).then(function (results) {
      var livesData = results[0];
      var allUploads = results[1];
      var liveIds = livesData.ids || {};

      /* Build stats map from uploads */
      var statsMap = buildStatsMap(allUploads);

      /* Get full video details for past lives */
      var pastLives = allUploads
        .filter(function (v) { return liveIds[v.id]; })
        .map(function (v) { return toItem(v); });

      /* If not found in uploads (very old streams), add from search results */
      livesData.items.forEach(function (searchItem) {
        var vid = searchItem.id && searchItem.id.videoId;
        if (vid && !pastLives.find(function (p) { return (p.id && p.id.videoId) === vid; })) {
          pastLives.push({
            id:      { videoId: vid },
            snippet: searchItem.snippet,
            _stats:  {},
            _dur:    0,
          });
        }
      });

      if (pastCountEl) pastCountEl.textContent = pastLives.length + ' past streams';

      pastGridEl.innerHTML = '';
      if (!pastLives.length) {
        pastGridEl.innerHTML = '<div class="empty-state"><div class="empty-icon">&#128247;</div>No past streams found.</div>';
        return;
      }
      var allHtml = pastLives.map(function (v) { return buildVideoCard(v, statsMap, { isPast: true }); });
      var loadMoreBtn = document.getElementById('past-lives-load-more');
      paginator(pastGridEl, loadMoreBtn, allHtml, PAGE_SIZE);
    }).catch(function (err) {
      console.error(err);
      pastGridEl.innerHTML = '<div class="empty-state"><div class="empty-icon">&#9888;&#65039;</div>Failed to load live streams.</div>';
    });
  }

  /* ─────────────────────────────────────────────────────────
   * WATCH PAGE
   * ───────────────────────────────────────────────────────── */
  function initWatchPage() {
    var videoId  = new URLSearchParams(location.search).get('id');
    var playerEl = document.getElementById('watch-player');
    if (!videoId) {
      if (playerEl) playerEl.innerHTML = '<div class="empty-state">No video specified.</div>';
      return;
    }
    if (playerEl) {
      playerEl.innerHTML =
        '<iframe src="https://www.youtube.com/embed/' + videoId +
          '?autoplay=0&rel=0" title="Video player"' +
          ' allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"' +
          ' allowfullscreen></iframe>';
    }
    apiFetch('videos', { part: 'snippet,statistics', id: videoId }).then(function (data) {
      var item = data.items && data.items[0]; if (!item) return;
      var titleEl = document.getElementById('watch-title'),
          metaEl  = document.getElementById('watch-meta'),
          statsEl = document.getElementById('watch-stats');
      if (titleEl) titleEl.textContent = item.snippet.title;
      document.title = item.snippet.title + ' — Mr. Si!ent';
      if (metaEl) metaEl.textContent = formatNum(item.statistics.viewCount || 0) + ' views · ' + formatDate(item.snippet.publishedAt);
      if (statsEl) {
        statsEl.innerHTML =
          '<span class="watch-stat-pill"><span>&#128065;</span> ' + formatNum(item.statistics.viewCount    || 0) + ' views</span>' +
          '<span class="watch-stat-pill watch-stat-like"><span>&#10084;</span> ' + formatNum(item.statistics.likeCount || 0) + ' likes</span>' +
          '<span class="watch-stat-pill"><span>&#128172;</span> ' + formatNum(item.statistics.commentCount || 0) + ' comments</span>';
      }
    }).catch(function (e) { console.warn(e); });

    var upEl = document.getElementById('up-next-list');
    if (upEl) {
      fetchAllUploads().then(function (videos) {
        var items = videos.filter(function (v) { return v.id !== videoId; }).slice(0, 6).map(toItem);
        upEl.innerHTML = items.map(function (v) {
          var vid = v.id.videoId, title = (v.snippet && v.snippet.title) || '', esc = title.replace(/"/g,'&quot;').replace(/</g,'&lt;');
          return '<a href="watch.html?id=' + vid + '" class="up-next-item">' +
            '<img class="up-next-thumb" src="' + thumbMQ(vid) + '" alt="' + esc + '" loading="lazy" />' +
            '<div><div class="up-next-title">' + title + '</div>' +
            '<div class="up-next-meta">' + formatDate(v.snippet && v.snippet.publishedAt) + '</div></div></a>';
        }).join('');
      }).catch(function (e) { console.warn(e); });
    }
  }

  /* ─────────────────────────────────────────────────────────
   * PLAYLISTS PAGE
   * ───────────────────────────────────────────────────────── */
  function fetchPlaylists() {
    var ck = 'pl_' + CHANNEL_ID, c = getCache(ck, 15 * 60000);
    if (c) return Promise.resolve(c);
    var all = [];
    function next(t) {
      var p = { part: 'snippet,contentDetails', channelId: CHANNEL_ID, maxResults: 50 };
      if (t) p.pageToken = t;
      return apiFetch('playlists', p).then(function (d) {
        all = all.concat(d.items || []);
        return d.nextPageToken ? next(d.nextPageToken) : all;
      });
    }
    return next(null).then(function (pls) { setCache(ck, pls); return pls; });
  }

  function initPlaylistsPage() {
    var grid = document.getElementById('playlists-grid'); if (!grid) return;
    grid.innerHTML = '<div class="spinner-wrap"><div class="spinner"></div></div>';
    fetchPlaylists().then(function (pls) {
      if (!pls.length) { grid.innerHTML = '<div class="empty-state"><div class="empty-icon">&#128194;</div>No public playlists.</div>'; return; }
      grid.innerHTML = pls.map(function (pl) {
        var id    = pl.id,
            title = (pl.snippet && pl.snippet.title) || '',
            count = (pl.contentDetails && pl.contentDetails.itemCount) || 0,
            esc   = title.replace(/"/g,'&quot;').replace(/</g,'&lt;');
        return '<div class="playlist-card fade-up">' +
          '<div class="playlist-title">' + title + '</div>' +
          '<div class="playlist-count">&#127916; ' + count + ' video' + (count !== 1 ? 's' : '') + '</div>' +
          '<div class="responsive-embed" style="border-radius:0 0 14px 14px;border-top:none;">' +
            '<iframe src="https://www.youtube.com/embed/videoseries?list=' + id + '" title="' + esc + '"' +
            ' allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"' +
            ' allowfullscreen loading="lazy"></iframe>' +
          '</div></div>';
      }).join('');
    }).catch(function (err) {
      grid.innerHTML = '<div class="empty-state"><div class="empty-icon">&#9888;&#65039;</div>Failed to load playlists.</div>';
      console.error(err);
    });
  }

  /* ─────────────────────────────────────────────────────────
   * ABOUT PAGE
   * ───────────────────────────────────────────────────────── */
  function initAboutPage() {
    fetchChannelInfo().then(function (info) {
      if (!info) return;
      if (info.thumb) document.querySelectorAll('.about-avatar,.sidebar-logo').forEach(function (img) { img.src = info.thumb; });
      var d = document.getElementById('channel-desc'); if (d && info.desc) d.textContent = info.desc;
      var s = document.getElementById('about-sub-count'); if (s) animateCount(s, info.subs, '');
      var s2 = document.getElementById('sub-count'); if (s2) animateCount(s2, info.subs, ' subscribers');
    }).catch(function (e) { console.warn(e); });
  }

  /* ─────────────────────────────────────────────────────────
   * RSS FALLBACK  (home page only)
   * ───────────────────────────────────────────────────────── */
  function fetchRSS() {
    var proxy = 'https://api.allorigins.win/raw?url=';
    return fetch(proxy + encodeURIComponent('https://www.youtube.com/feeds/videos.xml?channel_id=' + CHANNEL_ID))
      .then(function (r) { return r.text(); })
      .then(function (t) {
        var xml = new DOMParser().parseFromString(t, 'application/xml');
        return Array.from(xml.querySelectorAll('entry')).map(function (e) {
          var vid = (e.querySelector('videoId') || {}).textContent || '';
          return {
            id: { videoId: vid },
            snippet: {
              title:       ((e.querySelector('title')     || {}).textContent || ''),
              publishedAt: ((e.querySelector('published') || {}).textContent || ''),
            },
          };
        });
      });
  }

  /* ─────────────────────────────────────────────────────────
   * EXPOSE TO SHORTS.JS
   * ───────────────────────────────────────────────────────── */
  window._mrSilent = {
    fetchAllUploads:     fetchAllUploads,
    fetchVideosBatch:    fetchVideosBatch,
    buildStatsMap:       buildStatsMap,
    parseDuration:       parseDuration,
    thumbMQ:             thumbMQ,
    thumbHQ:             thumbHQ,
    formatNum:           formatNum,
    formatDate:          formatDate,
    formatDuration:      formatDuration,
    observeImages:       observeImages,
    paginator:           paginator,
    toItem:              toItem,
    CHANNEL_ID:          CHANNEL_ID,
    PAGE_SIZE:           PAGE_SIZE,
  };

  /* ─────────────────────────────────────────────────────────
   * SERVICE WORKER
   * ───────────────────────────────────────────────────────── */
  function registerSW() {
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(function () {});
  }

  /* ─────────────────────────────────────────────────────────
   * INIT
   * ───────────────────────────────────────────────────────── */
  function init() {
    highlightNav();
    initMobileNav();
    registerSW();
    var page = location.pathname.split('/').pop() || 'index.html';
    if      (page === 'index.html' || page === '') initHomePage();
    else if (page === 'videos.html')               initVideosPage();
    else if (page === 'watch.html')                initWatchPage();
    else if (page === 'live.html')                 initLivePage();
    else if (page === 'playlists.html')            initPlaylistsPage();
    else if (page === 'about.html')                initAboutPage();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
