/* © Mr. Si!ent Creator Hub — All Rights Reserved. */
(function () {
  'use strict';

  /* ── localStorage likes ────────────────────────────────── */
  var LIKES_KEY = 'mrsilent_short_likes';
  function getLikes()       { try { return JSON.parse(localStorage.getItem(LIKES_KEY) || '{}'); } catch (e) { return {}; } }
  function saveLikes(obj)   { try { localStorage.setItem(LIKES_KEY, JSON.stringify(obj)); } catch (e) {} }
  function isLiked(vid)     { return !!getLikes()[vid]; }
  function toggleLike(vid)  { var o = getLikes(); if (o[vid]) delete o[vid]; else o[vid] = 1; saveLikes(o); return !!o[vid]; }

  /* ── DOM refs ──────────────────────────────────────────── */
  var gridEl       = document.getElementById('shorts-grid');
  var emptyEl      = document.getElementById('shorts-empty');
  var loadingEl    = document.getElementById('shorts-loading');
  var countEl      = document.getElementById('shorts-count');
  var modalEl      = document.getElementById('short-modal');
  var modalPlayer  = document.getElementById('short-modal-player');
  var modalTitle   = document.getElementById('short-modal-title');
  var modalStats   = document.getElementById('short-modal-stats');
  var modalLikeBtn = document.getElementById('short-modal-like');
  var modalClose   = document.getElementById('short-modal-close');
  var modalPrev    = document.getElementById('short-modal-prev');
  var modalNext    = document.getElementById('short-modal-next');
  var modalYt      = document.getElementById('short-modal-yt');

  if (!gridEl) return;

  var shorts      = [];   /* all short items (toItem format) */
  var statsMap    = {};
  var activeIndex = 0;

  /* ── Build short card ──────────────────────────────────── */
  function buildShortCard(item, index) {
    var M     = window._mrSilent;
    var vid   = (item.id && item.id.videoId) || '';
    var title = (item.snippet && item.snippet.title) || '';
    var date  = M.formatDate(item.snippet && item.snippet.publishedAt);
    var esc   = title.replace(/"/g,'&quot;').replace(/</g,'&lt;');
    var st    = statsMap[vid];
    var liked = isLiked(vid);
    var fn    = M.formatNum;

    var durStr = item._durIso ? M.formatDuration(item._durIso) : '';
    var durBadge = durStr ? '<span class="dur-badge">' + durStr + '</span>' : '';

    var statsHtml = st
      ? '<div class="video-stats">' +
          '<span class="stat-pill"><span class="s-icon">&#128065;</span>' + fn(st.views)    + '</span>' +
          '<span class="stat-pill stat-like"><span class="s-icon">&#10084;</span>' + fn(st.likes)    + '</span>' +
          '<span class="stat-pill"><span class="s-icon">&#128172;</span>' + fn(st.comments) + '</span>' +
        '</div>'
      : '<div class="video-stats video-stats-loading"><span class="stat-skeleton"></span><span class="stat-skeleton"></span><span class="stat-skeleton"></span></div>';

    return '<div class="video-card short-card fade-up" data-index="' + index + '" data-vid="' + vid + '"' +
           ' role="button" tabindex="0" aria-label="' + esc + '">' +
      '<div class="thumb-wrap short-thumb-wrap">' +
        '<img data-src="' + M.thumbMQ(vid) + '" data-hq="' + M.thumbHQ(vid) + '"' +
             ' src="' + M.thumbMQ(vid) + '" alt="' + esc + '" loading="lazy" />' +
        '<div class="thumb-overlay"><div class="play-btn">&#9654;</div></div>' +
        '<span class="short-badge">&#9889; SHORT</span>' +
        durBadge +
      '</div>' +
      '<div class="video-info">' +
        '<div class="video-title">' + title + '</div>' +
        '<div class="video-meta">' + date + '</div>' +
        statsHtml +
        '<button class="short-like-btn' + (liked ? ' liked' : '') + '"' +
                ' data-vid="' + vid + '" aria-label="' + (liked ? 'Unlike' : 'Like') + '" aria-pressed="' + liked + '">' +
          '<span class="heart-icon">' + (liked ? '&#10084;' : '&#9825;') + '</span>' +
          '<span class="like-label">' + (liked ? 'Liked' : 'Like') + '</span>' +
        '</button>' +
      '</div></div>';
  }

  /* ── Sync like button state on a card ─────────────────── */
  function syncCardLike(vid) {
    var liked = isLiked(vid);
    gridEl.querySelectorAll('.short-like-btn[data-vid="' + vid + '"]').forEach(function (btn) {
      btn.className = 'short-like-btn' + (liked ? ' liked' : '');
      btn.setAttribute('aria-pressed', liked);
      btn.querySelector('.heart-icon').innerHTML = liked ? '&#10084;' : '&#9825;';
      btn.querySelector('.like-label').textContent = liked ? 'Liked' : 'Like';
    });
  }

  /* ── Open modal ────────────────────────────────────────── */
  function openModal(index) {
    if (!shorts[index] || !modalEl) return;
    activeIndex = index;
    var item  = shorts[index];
    var vid   = (item.id && item.id.videoId) || '';
    var title = (item.snippet && item.snippet.title) || '';
    var st    = statsMap[vid];
    var fn    = window._mrSilent.formatNum;
    var liked = isLiked(vid);

    if (modalPlayer) {
      modalPlayer.innerHTML =
        '<iframe src="https://www.youtube.com/embed/' + vid +
          '?autoplay=1&loop=1&playlist=' + vid + '&rel=0"' +
          ' title="' + title.replace(/"/g,'&quot;') + '"' +
          ' allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"' +
          ' allowfullscreen></iframe>';
    }
    if (modalTitle)   modalTitle.textContent = title;
    if (modalYt)      modalYt.href = 'https://www.youtube.com/shorts/' + vid;

    if (modalStats && st) {
      modalStats.innerHTML =
        '<span class="watch-stat-pill"><span>&#128065;</span> ' + fn(st.views)    + ' views</span>' +
        '<span class="watch-stat-pill watch-stat-like"><span>&#10084;</span> ' + fn(st.likes)    + ' likes</span>' +
        '<span class="watch-stat-pill"><span>&#128172;</span> ' + fn(st.comments) + ' comments</span>';
    } else if (modalStats) {
      modalStats.innerHTML = '';
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
    modalEl.removeAttribute('aria-hidden');
    document.body.style.overflow = 'hidden';
    syncCardLike(vid);
  }

  /* ── Close modal ───────────────────────────────────────── */
  function closeModal() {
    if (!modalEl) return;
    if (modalPlayer) modalPlayer.innerHTML = '';
    modalEl.classList.remove('open');
    modalEl.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  }

  /* ── Render grid (client-side paginated) ──────────────── */
  function renderGrid() {
    var M = window._mrSilent;
    if (countEl) countEl.textContent = shorts.length + ' shorts';
    gridEl.innerHTML = '';

    if (!shorts.length) {
      if (loadingEl) loadingEl.style.display = 'none';
      if (emptyEl)   emptyEl.style.display = 'block';
      return;
    }

    var allHtml = shorts.map(function (s, i) { return buildShortCard(s, i); });
    var loadMoreBtn = document.getElementById('shorts-load-more');
    M.paginator(gridEl, loadMoreBtn, allHtml, M.PAGE_SIZE);

    /* ── Click / keyboard events (delegated) ─────────────── */
    if (!gridEl._hasListeners) {
      gridEl._hasListeners = true;

      gridEl.addEventListener('click', function (e) {
        /* Like button */
        var likeBtn = e.target.closest('.short-like-btn');
        if (likeBtn) {
          e.preventDefault(); e.stopPropagation();
          var vid = likeBtn.dataset.vid;
          var nowLiked = toggleLike(vid);
          likeBtn.className = 'short-like-btn' + (nowLiked ? ' liked' : '');
          likeBtn.setAttribute('aria-pressed', nowLiked);
          likeBtn.querySelector('.heart-icon').innerHTML = nowLiked ? '&#10084;' : '&#9825;';
          likeBtn.querySelector('.like-label').textContent = nowLiked ? 'Liked' : 'Like';
          likeBtn.classList.add('pop');
          setTimeout(function () { likeBtn.classList.remove('pop'); }, 400);
          return;
        }
        /* Card click → modal */
        var card = e.target.closest('.short-card');
        if (card) { e.preventDefault(); openModal(parseInt(card.dataset.index, 10)); }
      });

      gridEl.addEventListener('keydown', function (e) {
        var card = e.target.closest('.short-card');
        if (card && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          openModal(parseInt(card.dataset.index, 10));
        }
      });
    }
  }

  /* ── Modal event listeners ─────────────────────────────── */
  if (modalClose) modalClose.addEventListener('click', closeModal);
  if (modalEl)    modalEl.addEventListener('click', function (e) { if (e.target === modalEl) closeModal(); });
  if (modalPrev)  modalPrev.addEventListener('click', function () { if (activeIndex > 0) openModal(activeIndex - 1); });
  if (modalNext)  modalNext.addEventListener('click', function () { if (activeIndex < shorts.length - 1) openModal(activeIndex + 1); });

  document.addEventListener('keydown', function (e) {
    if (!modalEl || !modalEl.classList.contains('open')) return;
    if (e.key === 'Escape')     closeModal();
    if (e.key === 'ArrowLeft'  && activeIndex > 0)               openModal(activeIndex - 1);
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

  /* Swipe on modal */
  if (modalPlayer) {
    var startX = null;
    modalPlayer.addEventListener('touchstart', function (e) { startX = e.touches[0].clientX; }, { passive: true });
    modalPlayer.addEventListener('touchend',   function (e) {
      if (startX === null) return;
      var dx = startX - e.changedTouches[0].clientX; startX = null;
      if (Math.abs(dx) < 50) return;
      if (dx > 0 && activeIndex < shorts.length - 1) openModal(activeIndex + 1);
      else if (dx < 0 && activeIndex > 0)            openModal(activeIndex - 1);
    }, { passive: true });
  }

  /* ── MAIN INIT ─────────────────────────────────────────── */
  function init() {
    if (loadingEl) loadingEl.style.display = 'flex';

    var M = window._mrSilent;
    if (!M) {
      if (loadingEl) loadingEl.style.display = 'none';
      if (emptyEl) { emptyEl.style.display = 'block'; emptyEl.textContent = 'Script error. Please refresh.'; }
      return;
    }

    M.fetchAllUploads().then(function (videos) {
      /* shorts = all uploads with duration ≤ 60s */
      shorts = videos.filter(function (v) {
        var dur = M.parseDuration((v.contentDetails || {}).duration);
        return dur > 0 && dur <= 60;
      }).map(M.toItem);

      /* Build stats map from what we already have */
      statsMap = M.buildStatsMap(videos);

      if (loadingEl) loadingEl.style.display = 'none';
      renderGrid();
    }).catch(function (err) {
      console.error('Shorts error:', err);
      if (loadingEl) loadingEl.style.display = 'none';
      if (emptyEl) { emptyEl.style.display = 'block'; emptyEl.textContent = 'Failed to load Shorts. Try refreshing.'; }
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
