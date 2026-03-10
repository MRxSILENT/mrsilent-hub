/* js/shorts.js - virtualized shorts feed with lazy iframe loading */
(async function(){
  const container = document.getElementById('shorts-viewer');
  if(!container) return;
  container.innerHTML = '';

  let videos = [];
  try {
    if(window._mrSilent && window._mrSilent.fetchVideosAPINetwork) {
      videos = await window._mrSilent.fetchVideosAPINetwork();
    } else {
      const rss = await fetch('https://api.allorigins.win/raw?url=' + encodeURIComponent('https://www.youtube.com/feeds/videos.xml?channel_id=' + (window.CHANNEL_ID || '')));
      const text = await rss.text();
      const parser = new DOMParser();
      const xml = parser.parseFromString(text, 'application/xml');
      videos = Array.from(xml.getElementsByTagName('entry') || []).map(e => {
        const vidNode = e.getElementsByTagName('yt:videoId')[0] || e.getElementsByTagName('videoId')[0];
        const id = vidNode ? vidNode.textContent.trim() : (e.getElementsByTagName('id')[0]?.textContent?.split(':').pop() || '');
        const title = e.getElementsByTagName('title')[0]?.textContent || '';
        const published = e.getElementsByTagName('published')[0]?.textContent || '';
        const mediaThumb = e.getElementsByTagName('media:thumbnail')[0];
        const thumbnail = mediaThumb?.getAttribute('url') || `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
        return { id, title, published, thumbnail };
      }).filter(v => v.id);
    }
  } catch(e) {
    console.warn('Shorts load failed', e);
    container.innerHTML = `<div class="about-card">Unable to load shorts.</div>`;
    return;
  }

  async function filterShortsByDuration(list) {
    if(!window._mrSilent || !window._mrSilent.fetchVideoDetails) return list;
    const ids = list.slice(0, 50).map(v => v.id);
    const details = await window._mrSilent.fetchVideoDetails(ids);
    return list.filter(v => {
      const iso = details[v.id];
      if(!iso) return false;
      const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
      if(!m) return false;
      const h = parseInt(m[1]||0,10), mm = parseInt(m[2]||0,10), s = parseInt(m[3]||0,10);
      const seconds = h*3600 + mm*60 + s;
      return seconds > 0 && seconds <= 60;
    });
  }

  let shorts = await filterShortsByDuration(videos).catch(()=>videos.slice(0,20));
  if(!shorts || shorts.length === 0) shorts = videos.slice(0,20);

  const ITEM_HEIGHT = window.innerHeight || 800;
  const BUFFER = 2;
  container.style.height = '100vh';
  container.style.overflowY = 'auto';
  container.style.position = 'relative';
  container.style.scrollSnapType = 'y mandatory';

  const listEl = document.createElement('div');
  listEl.style.position = 'relative';
  listEl.style.width = '100%';
  container.appendChild(listEl);

  const total = shorts.length;
  listEl.style.height = `${total * ITEM_HEIGHT}px`;

  const nodes = new Map();

  function renderIndex(i) {
    if(i < 0 || i >= total) return;
    if(nodes.has(i)) return;
    const v = shorts[i];
    const item = document.createElement('div');
    item.className = 'short-item';
    item.style.position = 'absolute';
    item.style.top = `${i * ITEM_HEIGHT}px`;
    item.style.left = '0';
    item.style.width = '100%';
    item.style.height = `${ITEM_HEIGHT}px`;
    item.style.display = 'flex';
    item.style.alignItems = 'center';
    item.style.justifyContent = 'center';
    item.style.scrollSnapAlign = 'center';
    item.style.background = 'linear-gradient(180deg, rgba(0,0,0,0.2), rgba(0,0,0,0.4))';

    const thumb = document.createElement('img');
    thumb.src = v.thumbnail;
    thumb.style.width = '360px';
    thumb.style.height = '640px';
    thumb.style.borderRadius = '18px';
    thumb.style.objectFit = 'cover';
    thumb.style.boxShadow = '0 0 40px rgba(0,179,255,0.06)';
    thumb.loading = 'lazy';

    const overlay = document.createElement('div');
    overlay.style.position = 'absolute';
    overlay.style.left = '20px';
    overlay.style.bottom = '40px';
    overlay.style.maxWidth = '60%';
    overlay.style.color = '#eaf6fb';
    overlay.style.textShadow = '0 2px 8px rgba(0,0,0,0.6)';
    overlay.innerHTML = `<div style="font-weight:700;font-size:16px">${escapeHtml(v.title)}</div>
                         <div style="color:var(--muted);font-size:13px">${formatDate(v.published)}</div>`;

    const io = new IntersectionObserver((entries, obs) => {
      entries.forEach(en => {
        if(en.isIntersecting) {
          const iframe = document.createElement('iframe');
          iframe.className = 'short-iframe';
          iframe.src = `https://www.youtube.com/embed/${v.id}?rel=0&playsinline=1`;
          iframe.allow = 'autoplay; encrypted-media';
          iframe.frameBorder = '0';
          iframe.style.width = '360px';
          iframe.style.height = '640px';
          iframe.style.borderRadius = '18px';
          iframe.loading = 'lazy';
          item.replaceChild(iframe, thumb);
          obs.disconnect();
        }
      });
    }, { root: container, rootMargin: '400px' });

    item.appendChild(thumb);
    item.appendChild(overlay);
    listEl.appendChild(item);
    nodes.set(i, { el: item, io });
    io.observe(item);
    item.addEventListener('click', () => location.href = `watch.html?id=${v.id}`);
  }

  function cleanupRange(start, end) {
    for(const [i, obj] of nodes.entries()) {
      if(i < start - BUFFER || i > end + BUFFER) {
        obj.io.disconnect();
        obj.el.remove();
        nodes.delete(i);
      }
    }
  }

  function onScroll() {
    const scrollTop = container.scrollTop;
    const centerIndex = Math.floor((scrollTop + (window.innerHeight/2)) / ITEM_HEIGHT);
    const start = Math.max(0, centerIndex - 3 - BUFFER);
    const end = Math.min(total - 1, centerIndex + 3 + BUFFER);
    for(let i = start; i <= end; i++) renderIndex(i);
    cleanupRange(start, end);
  }

  container.addEventListener('scroll', throttle(onScroll, 80));
  onScroll();

  function throttle(fn, wait) {
    let last = 0;
    return function(...args) {
      const now = Date.now();
      if(now - last > wait) {
        last = now;
        fn.apply(this, args);
      }
    };
  }

  function escapeHtml(s){ return String(s || '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
  function formatDate(iso){ if(!iso) return ''; const d = new Date(iso); return d.toLocaleDateString(); }
})();
