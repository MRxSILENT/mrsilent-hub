/* © Mr. Si!ent Creator Hub — All Rights Reserved. */
(function () {
  'use strict';

  /* ── Parse ISO 8601 duration → seconds ────────────────── */
  function parseDuration(iso) {
    if (!iso) return Infinity;
    var m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
    if (!m) return Infinity;
    return (parseInt(m[1] || 0) * 3600) + (parseInt(m[2] || 0) * 60) + parseInt(m[3] || 0);
  }

  /* ── localStorage likes ────────────────────────────────── */
  var LIKES_KEY = 'mrsilent_short_likes';
  function getLikes() { try { return JSON.parse(localStorage.getItem(LIKES_KEY) || '{}'); } catch (e) { return {}; } }
  function saveLikes(obj) { try { localStorage.setItem(LIKES_KEY, JSON.stringify(obj)); } catch (e) {} }
  function isLiked(vid) { return !!getLikes()[vid]; }
  function toggleLike(vid) { var obj = getLikes(); if (obj[vid]) { delete obj[vid]; } else { obj[vid] = 1; } saveLikes(obj); return !!obj[vid]; }

  /* ── Refs ──────────────────────────────────────────────── */
  var gridEl    = document.getElementById('shorts-grid');
  var emptyEl   = document.getElementById('shorts-empty');
  var loadingEl = document.getElementById('shorts-loading');
  var countEl   = document.getElementById('shorts-count');
  var modalEl   = document.getElementById('short-modal');
  var modalPlayer = document.getElementById('short-modal-player');
  var modalTitle  = document.getElementById('short-modal-title');
  var modalStats  = document.getElementById('short-modal-stats');
  var modalLikeBtn = document.getElementById('short-modal-like');
  var modalClose  = document.getElementById('short-modal-close');
  var modalPrev   = document.getElementById('short-modal-prev');
  var modalNext   = document.getElementById('short-modal-next');

  if (!gridEl) return;

  var shorts = [];
  var activeIndex = 0;
  var statsMap = {};

  /* ── Build short card (grid) ───────────────────────────── */
  function buildShortCard(short, index, stats) {
    var vid   = (short.id && short.id.videoId) || '';
    var title = (short.snippet && short.snippet.title) || '';
    var date  = window._mrSilent.formatDate(short.snippet && short.snippet.publishedAt);
    var esc   = title.replace(/"/g, '&quot;').replace(/</g, '&lt;');
    var st    = stats && stats[vid];
    var liked = isLiked(vid);
    var fn    = window._mrSilent.formatNum;

    var statsHtml = st
      ? '<div class="video-stats">' +
          '<span class="stat-pill"><span class="s-icon">&#128065;</span>' + fn(st.views)    + '</span>' +
          '<span class="stat-pill stat-like"><span class="s-icon">&#10084;</span>' + fn(st.likes)    + '</span>' +
          '<span class="stat-pill"><span class="s-icon">&#128172;</span>' + fn(st.comments) + '</span>' +
        '</div>'
      : '<div class="video-stats video-stats-loading"><span class="stat-skeleton"></span><span class="stat-skeleton"></span></div>';

    return '<div class="video-card short-card fade-up" data-index="' + index + '" data-vid="' + vid + '" role="button" tabindex="0" aria-label="' + esc + '">' +
      '<div class="thumb-wrap short-thumb-wrap">' +
        '<img data-src="' + window._mrSilent.thumbMQ(vid) + '" data-hq="' + window._mrSilent.thumbHQ(vid) + '" src="' + window._mrSilent.thumbMQ(vid) + '" alt="' + esc + '" loading="lazy" />' +
        '<div class="thumb-overlay"><div class="play-btn">&#9654;</div></div>' +
        '<div class="short-badge">&#9889; SHORT</div>' +
      '</div>' +
      '<div class="video-info">' +
        '<div class="video-title">' + title + '</div>' +
        '<div class="video-meta">' + date + '</div>' +
        statsHtml +
        '<button class="short-like-btn' + (liked ? ' liked' : '') + '" data-vid="' + vid + '" aria-label="' + (liked ? 'Unlike' : 'Like') + ' this short" aria-pressed="' + liked + '">' +
          '<span class="heart-icon">' + (liked ? '&#10084;' : '&#9825;') + '</span>' +
          '<span class="like-label">' + (liked ? 'Liked' : 'Like') + '</span>' +
        '</button>' +
      '</div></div>';
  }

  /* ── Open modal player ─────────────────────────────────── */
  function openModal(index) {
    if (!shorts[index] || !modalEl) return;
    activeIndex = index;
    var short = shorts[index];
    var vid   = (short.id && short.id.videoId) || '';
    var title = (short.snippet && short.snippet.title) || '';
    var st    = statsMap[vid];
    var fn    = window._mrSilent.formatNum;
    var liked = isLiked(vid);

    if (modalPlayer) {
      modalPlayer.innerHTML = '<iframe src="https://www.youtube.com/embed/' + vid +
        '?autoplay=1&loop=1&playlist=' + vid + '&rel=0" title="' + title.replace(/"/g,'&quot;') +
        '" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>';
    }
    if (modalTitle) modalTitle.textContent = title;
    if (modalStats && st) {
      modalStats.innerHTML =
        '<span class="watch-stat-pill"><span>&#128065;</span> ' + fn(st.views)    + ' views</span>' +
        '<span class="watch-stat-pill watch-stat-like"><span>&#10084;</span> ' + fn(st.likes)    + ' likes</span>' +
        '<span class="watch-stat-pill"><span>&#128172;</span> ' + fn(st.comments) + ' comments</span>';
    }
    if (modalLikeBtn) {
      modalLikeBtn.className = 'modal-like-btn' + (liked ? ' liked' : '');
      modalLikeBtn.setAttribute('aria-pressed', liked);
      modalLikeBtn.setAttribute('data-vid', vid);
      modalLikeBtn.innerHTML = '<span>' + (liked ? '&#10084;' : '&#9825;') + '</span> ' + (liked ? 'Liked' : 'Like');
    }
    if (modalPrev) modalPrev.disabled = index <= 0;
    if (modalNext) modalNext.disabled = index >= shorts.length - 1;

    modalEl.classList.add('open');
    document.body.style.overflow = 'hidden';

    // sync like button on the card
    syncCardLike(vid);
  }

  /* ── Close modal ───────────────────────────────────────── */
  function closeModal() {
    if (!modalEl) return;
    if (modalPlayer) modalPlayer.innerHTML = '';
    modalEl.classList.remove('open');
    document.body.style.overflow = '';
  }

  /* ── Sync like state between modal and card ────────────── */
  function syncCardLike(vid) {
    var liked = isLiked(vid);
    gridEl.querySelectorAll('.short-like-btn[data-vid="' + vid + '"]').forEach(function (btn) {
      btn.className = 'short-like-btn' + (liked ? ' liked' : '');
      btn.setAttribute('aria-pressed', liked);
      btn.setAttribute('aria-label', (liked ? 'Unlike' : 'Like') + ' this short');
      btn.querySelector('.heart-icon').innerHTML = liked ? '&#10084;' : '&#9825;';
      btn.querySelector('.like-label').textContent = liked ? 'Liked' : 'Like';
    });
  }

  /* ── Render grid ───────────────────────────────────────── */
  function renderGrid(stats) {
    statsMap = stats || {};
    gridEl.innerHTML = shorts.map(function (s, i) { return buildShortCard(s, i, statsMap); }).join('');
    if (countEl) countEl.textContent = shorts.length + ' shorts';
    window._mrSilent.observeImages();
    // Second pass for browser-cached images that fire onload before observer attaches
    setTimeout(function () { window._mrSilent.observeImages(); }, 120);

    /* ── Card click → open modal ──────────────────────── */
    gridEl.addEventListener('click', function (e) {
      // Like button — stop propagation
      var likeBtn = e.target.closest('.short-like-btn');
      if (likeBtn) {
        e.preventDefault(); e.stopPropagation();
        var vid = likeBtn.dataset.vid;
        var nowLiked = toggleLike(vid);
        likeBtn.className = 'short-like-btn' + (nowLiked ? ' liked' : '');
        likeBtn.setAttribute('aria-pressed', nowLiked);
        likeBtn.setAttribute('aria-label', (nowLiked ? 'Unlike' : 'Like') + ' this short');
        likeBtn.querySelector('.heart-icon').innerHTML = nowLiked ? '&#10084;' : '&#9825;';
        likeBtn.querySelector('.like-label').textContent = nowLiked ? 'Liked' : 'Like';
        // animate
        likeBtn.classList.add('pop');
        setTimeout(function () { likeBtn.classList.remove('pop'); }, 400);
        return;
      }
      // Card click
      var card = e.target.closest('.short-card');
      if (card) { e.preventDefault(); openModal(parseInt(card.dataset.index)); }
    });

    gridEl.addEventListener('keydown', function (e) {
      var card = e.target.closest('.short-card');
      if (card && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); openModal(parseInt(card.dataset.index)); }
    });
  }

  /* ── Modal controls ────────────────────────────────────── */
  if (modalClose) modalClose.addEventListener('click', closeModal);
  if (modalEl)    modalEl.addEventListener('click', function (e) { if (e.target === modalEl) closeModal(); });
  if (modalPrev)  modalPrev.addEventListener('click', function () { if (activeIndex > 0) openModal(activeIndex - 1); });
  if (modalNext)  modalNext.addEventListener('click', function () { if (activeIndex < shorts.length - 1) openModal(activeIndex + 1); });

  document.addEventListener('keydown', function (e) {
    if (!modalEl || !modalEl.classList.contains('open')) return;
    if (e.key === 'Escape')     closeModal();
    if (e.key === 'ArrowLeft'  && activeIndex > 0)              openModal(activeIndex - 1);
    if (e.key === 'ArrowRight' && activeIndex < shorts.length - 1) openModal(activeIndex + 1);
  });

  if (modalLikeBtn) {
    modalLikeBtn.addEventListener('click', function () {
      var vid = modalLikeBtn.dataset.vid; if (!vid) return;
      var nowLiked = toggleLike(vid);
      modalLikeBtn.className = 'modal-like-btn' + (nowLiked ? ' liked' : '');
      modalLikeBtn.setAttribute('aria-pressed', nowLiked);
      modalLikeBtn.innerHTML = '<span>' + (nowLiked ? '&#10084;' : '&#9825;') + '</span> ' + (nowLiked ? 'Liked' : 'Like');
      modalLikeBtn.classList.add('pop');
      setTimeout(function () { modalLikeBtn.classList.remove('pop'); }, 400);
      syncCardLike(vid);
    });
  }

  /* ── Swipe on modal player ─────────────────────────────── */
  if (modalPlayer) {
    var startX = null;
    modalPlayer.addEventListener('touchstart', function (e) { startX = e.touches[0].clientX; }, { passive: true });
    modalPlayer.addEventListener('touchend', function (e) {
      if (startX === null) return;
      var dx = startX - e.changedTouches[0].clientX; startX = null;
      if (Math.abs(dx) < 50) return;
      if (dx > 0 && activeIndex < shorts.length - 1) openModal(activeIndex + 1);
      else if (dx < 0 && activeIndex > 0) openModal(activeIndex - 1);
    }, { passive: true });
  }

  /* ── Main init ─────────────────────────────────────────── */
  function init() {
    if (loadingEl) loadingEl.style.display = 'flex';

    if (!window._mrSilent) {
      if (loadingEl) loadingEl.style.display = 'none';
      if (emptyEl) { emptyEl.style.display = 'block'; emptyEl.textContent = 'Script error. Please refresh.'; }
      return;
    }

    window._mrSilent.fetchAllVideos()
      .then(function (allVideos) {
        var ids = allVideos.map(function (v) { return (v.id && v.id.videoId) || ''; }).filter(Boolean);
        if (!ids.length) throw new Error('No videos');
        return window._mrSilent.fetchVideoDetails(ids).then(function (details) {
          var durMap = {};
          details.forEach(function (d) { durMap[d.id] = parseDuration((d.contentDetails || {}).duration); });
          shorts = allVideos.filter(function (v) {
            var vid = (v.id && v.id.videoId) || '';
            return durMap[vid] !== undefined && durMap[vid] <= 60;
          });
        });
      })
      .then(function () {
        if (loadingEl) loadingEl.style.display = 'none';
        if (!shorts.length) { if (emptyEl) emptyEl.style.display = 'block'; return; }

        // render without stats first
        renderGrid(null);

        // fetch stats and re-render cards with real numbers
        var ids = shorts.map(function (v) { return (v.id && v.id.videoId) || ''; }).filter(Boolean);
        return window._mrSilent.fetchVideoStats(ids).then(function (stats) {
          statsMap = stats;
          gridEl.querySelectorAll('.short-card').forEach(function (card, i) {
            var short = shorts[i]; if (!short) return;
            var vid = (short.id && short.id.videoId) || '';
            var st = stats[vid]; if (!st) return;
            var fn = window._mrSilent.formatNum;
            var statsEl = card.querySelector('.video-stats');
            if (statsEl) {
              statsEl.className = 'video-stats';
              statsEl.innerHTML =
                '<span class="stat-pill"><span class="s-icon">&#128065;</span>' + fn(st.views)    + '</span>' +
                '<span class="stat-pill stat-like"><span class="s-icon">&#10084;</span>' + fn(st.likes)    + '</span>' +
                '<span class="stat-pill"><span class="s-icon">&#128172;</span>' + fn(st.comments) + '</span>';
            }
          });
        }).catch(function () {});
      })
      .catch(function (err) {
        console.error('Shorts error:', err);
        if (loadingEl) loadingEl.style.display = 'none';
        if (emptyEl) { emptyEl.style.display = 'block'; emptyEl.textContent = 'Failed to load Shorts.'; }
      });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
