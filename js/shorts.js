/* © Mr. Si!ent Creator Hub — All Rights Reserved. */
(function () {
  'use strict';

  /* ── Parse ISO 8601 duration → seconds ──────────────────── */
  function parseDuration(iso) {
    if (!iso) return Infinity;
    var m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
    if (!m) return Infinity;
    return (parseInt(m[1] || 0) * 3600) +
           (parseInt(m[2] || 0) * 60)  +
           (parseInt(m[3] || 0));
  }

  /* ── State ───────────────────────────────────────────────── */
  var shorts      = [];
  var activeIndex = 0;

  /* ── DOM ─────────────────────────────────────────────────── */
  var listEl    = document.getElementById('shorts-list');
  var playerEl  = document.getElementById('shorts-player');
  var emptyEl   = document.getElementById('shorts-empty');
  var loadingEl = document.getElementById('shorts-loading');
  var countEl   = document.getElementById('shorts-count');

  if (!listEl) return; // not on shorts page

  /* ── Build list item ─────────────────────────────────────── */
  function buildItem(short, index) {
    var vid   = (short.id && short.id.videoId) || '';
    var title = (short.snippet && short.snippet.title) || '';
    var thumb = 'https://i.ytimg.com/vi/' + vid + '/mqdefault.jpg';
    var esc   = title.replace(/"/g, '&quot;').replace(/</g, '&lt;');

    var el = document.createElement('div');
    el.className   = 'short-item' + (index === 0 ? ' active' : '');
    el.dataset.index = index;
    el.dataset.vid   = vid;
    el.setAttribute('role', 'button');
    el.setAttribute('tabindex', '0');
    el.setAttribute('aria-label', title);
    el.innerHTML =
      '<img data-src="' + thumb + '" src="' + thumb + '" alt="' + esc + '" loading="lazy" />' +
      '<div class="short-item-overlay">' +
        '<div class="short-item-title">' + title + '</div>' +
      '</div>';
    return el;
  }

  /* ── Load player ─────────────────────────────────────────── */
  function loadPlayer(index) {
    if (!shorts[index] || !playerEl) return;
    var vid   = (shorts[index].id && shorts[index].id.videoId) || '';
    var title = (shorts[index].snippet && shorts[index].snippet.title) || '';
    var esc   = title.replace(/"/g, '&quot;').replace(/</g, '&lt;');

    playerEl.innerHTML = '<iframe src="https://www.youtube.com/embed/' + vid +
      '?autoplay=1&loop=1&playlist=' + vid + '&rel=0" title="' + esc +
      '" allow="accelerometer; autoplay; clipboard-write; encrypted-media; ' +
      'gyroscope; picture-in-picture" allowfullscreen></iframe>';

    listEl.querySelectorAll('.short-item').forEach(function (el, i) {
      el.classList.toggle('active', i === index);
    });

    var active = listEl.querySelector('.short-item.active');
    if (active) active.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }

  /* ── Lazy-load thumbnails ────────────────────────────────── */
  function observeImages() {
    if (!('IntersectionObserver' in window)) {
      listEl.querySelectorAll('img[data-src]').forEach(function (img) {
        img.src = img.dataset.src;
        img.classList.add('loaded');
      });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        var img = e.target;
        img.src = img.dataset.src;
        img.onload = function () { img.classList.add('loaded'); };
        io.unobserve(img);
      });
    }, { rootMargin: '300px' });
    listEl.querySelectorAll('img[data-src]').forEach(function (img) { io.observe(img); });
  }

  /* ── Render list ─────────────────────────────────────────── */
  function renderList() {
    var frag = document.createDocumentFragment();
    shorts.forEach(function (s, i) { frag.appendChild(buildItem(s, i)); });
    listEl.innerHTML = '';
    listEl.appendChild(frag);

    if (countEl) countEl.textContent = shorts.length + ' shorts';

    listEl.addEventListener('click', function (e) {
      var item = e.target.closest('.short-item');
      if (!item) return;
      activeIndex = parseInt(item.dataset.index);
      loadPlayer(activeIndex);
    });
    listEl.addEventListener('keydown', function (e) {
      var item = e.target.closest('.short-item');
      if (item && (e.key === 'Enter' || e.key === ' ')) {
        e.preventDefault();
        activeIndex = parseInt(item.dataset.index);
        loadPlayer(activeIndex);
      }
    });

    observeImages();
  }

  /* ── Keyboard navigation ─────────────────────────────────── */
  document.addEventListener('keydown', function (e) {
    if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
      e.preventDefault();
      if (activeIndex < shorts.length - 1) { activeIndex++; loadPlayer(activeIndex); }
    } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
      e.preventDefault();
      if (activeIndex > 0) { activeIndex--; loadPlayer(activeIndex); }
    }
  });

  /* ── Swipe on mobile ─────────────────────────────────────── */
  if (playerEl) {
    var startY = null;
    playerEl.addEventListener('touchstart', function (e) {
      startY = e.touches[0].clientY;
    }, { passive: true });
    playerEl.addEventListener('touchend', function (e) {
      if (startY === null) return;
      var dy = startY - e.changedTouches[0].clientY;
      if (Math.abs(dy) < 40) { startY = null; return; }
      if (dy > 0 && activeIndex < shorts.length - 1) { activeIndex++; loadPlayer(activeIndex); }
      else if (dy < 0 && activeIndex > 0)             { activeIndex--; loadPlayer(activeIndex); }
      startY = null;
    }, { passive: true });
  }

  /* ── Main Init ───────────────────────────────────────────── */
  function init() {
    if (loadingEl) loadingEl.style.display = 'flex';

    if (!window._mrSilent) {
      if (loadingEl) loadingEl.style.display = 'none';
      if (emptyEl) { emptyEl.style.display = 'flex'; emptyEl.textContent = 'Script not loaded correctly.'; }
      return;
    }

    window._mrSilent.fetchAllVideos()
      .then(function (allVideos) {
        var ids = allVideos.map(function (v) { return (v.id && v.id.videoId) || ''; }).filter(Boolean);
        if (!ids.length) throw new Error('No videos');
        return window._mrSilent.fetchVideoDetails(ids).then(function (details) {
          var durMap = {};
          details.forEach(function (d) { durMap[d.id] = parseDuration(d.contentDetails && d.contentDetails.duration); });
          shorts = allVideos.filter(function (v) {
            var vid = (v.id && v.id.videoId) || '';
            var dur = durMap[vid];
            return dur !== undefined && dur <= 60;
          });
        });
      })
      .then(function () {
        if (loadingEl) loadingEl.style.display = 'none';
        if (!shorts.length) {
          if (emptyEl) emptyEl.style.display = 'flex';
          return;
        }
        renderList();
        loadPlayer(0);
      })
      .catch(function (err) {
        console.error('Shorts error:', err);
        if (loadingEl) loadingEl.style.display = 'none';
        if (emptyEl) { emptyEl.style.display = 'flex'; emptyEl.textContent = 'Failed to load Shorts. Try again later.'; }
      });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

})();
