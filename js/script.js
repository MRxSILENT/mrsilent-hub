/* js/script.js - optimized: caching, debounced search, minimal DOM updates, background refresh */
const API_KEY = 'AIzaSyAEBSwFQQHGdg7EdKTWXaBvl6b6cOhFpXc';
window.API_KEY = API_KEY;
const CHANNEL_ID = window.CHANNEL_ID || 'UCKQ_q75TKeAcYXYeu0uaWlQ';
const YT_BASE = 'https://www.googleapis.com/youtube/v3';
const SEARCH_ENDPOINT = `${YT_BASE}/search`;
const CHANNELS_ENDPOINT = `${YT_BASE}/channels`;
const VIDEOS_ENDPOINT = `${YT_BASE}/videos`;
const PLAYLISTS_ENDPOINT = `${YT_BASE}/playlists`;
const RSS_URL = `https://www.youtube.com/feeds/videos.xml?channel_id=${CHANNEL_ID}`;
const PROXY = 'https://api.allorigins.win/raw?url=';

const CACHE_KEYS = {
  videos: `mr-videos-${CHANNEL_ID}`,
  subs: `mr-subs-${CHANNEL_ID}`,
  playlists: `mr-playlists-${CHANNEL_ID}`
};
const CACHE_TTL = {
  videos: 1000 * 60 * 5,
  subs: 1000 * 60 * 5,
  playlists: 1000 * 60 * 60
};

function log(...args){ console.log('[mr-silent]', ...args); }
function err(...args){ console.error('[mr-silent]', ...args); }
function escapeHtml(s){ return String(s || '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function formatDate(iso){ if(!iso) return ''; const d = new Date(iso); return d.toLocaleDateString(); }
function formatCompact(n){ if(n>=1_000_000) return (n/1_000_000).toFixed(1).replace(/\.0$/,'')+'M'; if(n>=1000) return (n/1000).toFixed(1).replace(/\.0$/,'')+'K'; return String(n); }

function setCache(key, data) {
  try {
    localStorage.setItem(key, JSON.stringify({ ts: Date.now(), data }));
  } catch(e) { /* ignore */ }
}
function getCache(key, maxAge) {
  try {
    const raw = localStorage.getItem(key);
    if(!raw) return null;
    const parsed = JSON.parse(raw);
    if(Date.now() - parsed.ts > maxAge) return null;
    return parsed.data;
  } catch(e) { return null; }
}

async function fetchJson(url) {
  const res = await fetch(url);
  if(!res.ok) throw new Error(`Fetch ${res.status}`);
  return res.json();
}
async function fetchText(url) {
  const res = await fetch(url);
  if(!res.ok) throw new Error(`Fetch ${res.status}`);
  return res.text();
}

function createVideoCard(video) {
  const a = document.createElement('a');
  a.className = 'video-card';
  a.href = `watch.html?id=${video.id}`;
  const low = `https://i.ytimg.com/vi/${video.id}/mqdefault.jpg`;
  const high = video.thumbnail || `https://i.ytimg.com/vi/${video.id}/hqdefault.jpg`;
  a.innerHTML = `
    <div class="thumb-wrap" style="background:#000">
      <img class="thumb low" src="${low}" alt="" aria-hidden="true" />
      <img class="thumb high" data-src="${high}" alt="${escapeHtml(video.title)}" />
    </div>
    <div class="video-info">
      <h3 class="video-title">${escapeHtml(video.title)}</h3>
      <div class="video-meta">${formatDate(video.published)}</div>
    </div>
  `;
  observeImage(a.querySelector('.thumb.high'));
  return a;
}

const imgObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if(entry.isIntersecting) {
      const img = entry.target;
      const src = img.getAttribute('data-src');
      if(src) {
        img.src = src;
        img.removeAttribute('data-src');
        img.style.opacity = '1';
      }
      imgObserver.unobserve(img);
    }
  });
}, { rootMargin: '200px' });

function observeImage(img) {
  if(!img) return;
  img.style.transition = 'opacity .35s ease';
  img.style.opacity = '0';
  imgObserver.observe(img);
}

function debounce(fn, wait) {
  let t;
  return function(...args) {
    clearTimeout(t);
    t = setTimeout(() => fn.apply(this, args), wait);
  };
}

async function fetchVideosAPI(maxResults = 50) {
  const cache = getCache(CACHE_KEYS.videos, CACHE_TTL.videos);
  if(cache) {
    requestIdleCallback(() => fetchVideosAPINetwork(maxResults).catch(()=>{}));
    return cache;
  }
  const data = await fetchVideosAPINetwork(maxResults);
  setCache(CACHE_KEYS.videos, data);
  return data;
}
async function fetchVideosAPINetwork(maxResults = 50) {
  const url = `${SEARCH_ENDPOINT}?part=snippet&channelId=${CHANNEL_ID}&order=date&type=video&maxResults=${maxResults}&key=${API_KEY}`;
  const res = await fetchJson(url);
  const videos = (res.items || []).map(item => {
    const id = item.id?.videoId;
    const snip = item.snippet || {};
    const thumbnail = snip.thumbnails?.high?.url || snip.thumbnails?.default?.url || `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
    return { id, title: snip.title || '', published: snip.publishedAt || '', thumbnail, description: snip.description || '' };
  }).filter(v => v.id);
  return videos;
}

async function fetchSubscriberCountCached() {
  const cache = getCache(CACHE_KEYS.subs, CACHE_TTL.subs);
  if(cache) {
    requestIdleCallback(() => fetchSubscriberCountNetwork().then(s => setCache(CACHE_KEYS.subs, s)).catch(()=>{}));
    return cache;
  }
  const subs = await fetchSubscriberCountNetwork();
  setCache(CACHE_KEYS.subs, subs);
  return subs;
}
async function fetchSubscriberCountNetwork() {
  const url = `${CHANNELS_ENDPOINT}?part=statistics&id=${CHANNEL_ID}&key=${API_KEY}`;
  const res = await fetchJson(url);
  const subs = Number(res.items?.[0]?.statistics?.subscriberCount || 0);
  return subs;
}

async function fetchPlaylistsCached() {
  const cache = getCache(CACHE_KEYS.playlists, CACHE_TTL.playlists);
  if(cache) {
    requestIdleCallback(() => fetchPlaylistsNetwork().then(d => setCache(CACHE_KEYS.playlists, d)).catch(()=>{}));
    return cache;
  }
  const data = await fetchPlaylistsNetwork();
  setCache(CACHE_KEYS.playlists, data);
  return data;
}
async function fetchPlaylistsNetwork() {
  let next = '';
  const all = [];
  do {
    const url = `${PLAYLISTS_ENDPOINT}?part=snippet&channelId=${CHANNEL_ID}&maxResults=50${next ? '&pageToken=' + next : ''}&key=${API_KEY}`;
    const res = await fetchJson(url);
    (res.items || []).forEach(p => all.push({ id: p.id, title: p.snippet?.title || '' }));
    next = res.nextPageToken || '';
  } while(next);
  return all;
}

async function renderVideosAndUI() {
  const videos = await fetchVideosAPI(50).catch(async () => {
    try {
      const xml = await fetchText(PROXY + encodeURIComponent(RSS_URL));
      return parseRssXml(xml);
    } catch(e) {
      err('Both API and RSS failed', e);
      return [];
    }
  });

  const grid = document.getElementById('videos-grid') || document.getElementById('videos-grid-all');
  if(grid) {
    const frag = document.createDocumentFragment();
    const list = (grid.id === 'videos-grid') ? videos.slice(0, 12) : videos;
    if(list.length === 0) {
      grid.innerHTML = `<div class="about-card">No videos available right now.</div>`;
    } else {
      list.forEach(v => frag.appendChild(createVideoCard(v)));
      grid.innerHTML = '';
      grid.appendChild(frag);
    }
  }

  const trendingRow = document.getElementById('trending-row');
  if(trendingRow) {
    trendingRow.innerHTML = '';
    const frag = document.createDocumentFragment();
    videos.slice(0,3).forEach(v => {
      const card = document.createElement('div');
      card.className = 'trending-card';
      card.innerHTML = `<a href="watch.html?id=${v.id}" style="text-decoration:none;color:inherit">
        <img src="${v.thumbnail}" style="width:100%;height:160px;object-fit:cover;border-radius:8px" />
        <h4 style="margin:10px 0 6px;color:var(--accent)">${escapeHtml(v.title)}</h4>
        <div style="color:var(--muted);font-size:13px">${formatDate(v.published)}</div>
      </a>`;
      frag.appendChild(card);
    });
    trendingRow.appendChild(frag);
  }

  const upnext = document.getElementById('upnext');
  if(upnext) {
    upnext.innerHTML = '';
    const frag = document.createDocumentFragment();
    videos.slice(0,8).forEach(v => {
      const el = document.createElement('a');
      el.href = `watch.html?id=${v.id}`;
      el.className = 'video-card';
      el.style.display = 'flex';
      el.style.gap = '8px';
      el.style.alignItems = 'center';
      el.innerHTML = `<img src="${v.thumbnail}" style="width:120px;height:68px;object-fit:cover;border-radius:8px" />
        <div style="flex:1">
          <div style="font-size:13px;color:#eaf6fb">${escapeHtml(v.title)}</div>
          <div style="font-size:12px;color:var(--muted)">${formatDate(v.published)}</div>
        </div>`;
      frag.appendChild(el);
    });
    upnext.appendChild(frag);
  }

  attachSearchHandlers(videos);
}

function attachSearchHandlers(videos) {
  const input = document.getElementById('search-input') || document.getElementById('search-input-2');
  if(!input) return;
  const doSearch = (q) => {
    const grid = document.getElementById('videos-grid') || document.getElementById('videos-grid-all');
    if(!grid) return;
    grid.innerHTML = '';
    const filtered = videos.filter(v => (v.title + ' ' + v.description).toLowerCase().includes(q));
    if(filtered.length === 0) {
      grid.innerHTML = `<div class="about-card">No videos found for "${escapeHtml(q)}".</div>`;
    } else {
      const frag = document.createDocumentFragment();
      filtered.forEach(v => frag.appendChild(createVideoCard(v)));
      grid.appendChild(frag);
    }
  };
  const deb = debounce(e => doSearch(e.target.value.trim().toLowerCase()), 220);
  input.addEventListener('input', deb);
}

async function initSubscriberCounter() {
  const el = document.getElementById('subscriber-counter') || document.getElementById('subscriber-counter-2');
  if(!el) return;
  const subs = await fetchSubscriberCountCached().catch(() => null);
  if(subs) {
    animateNumber(el, subs);
  } else {
    const placeholder = el.getAttribute('data-placeholder') || '12.3K';
    el.textContent = `${placeholder} subscribers`;
  }
}

function animateNumber(el, target) {
  const start = 0;
  const duration = 900;
  const startTime = performance.now();
  function tick(now) {
    const t = Math.min(1, (now - startTime) / duration);
    const eased = t*(2-t);
    const current = Math.floor(start + (target - start) * eased);
    el.textContent = formatCompact(current) + ' subscribers';
    if(t < 1) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

function initWatchPage() {
  const params = new URLSearchParams(location.search);
  const id = params.get('id');
  const playerWrap = document.getElementById('player-wrap');
  if(!playerWrap) return;
  if(!id) {
    playerWrap.innerHTML = `<div class="about-card">No video selected. Go to <a href="videos.html">Videos</a>.</div>`;
    return;
  }
  const placeholder = document.createElement('div');
  placeholder.style.width = '100%';
  placeholder.style.height = '520px';
  placeholder.style.background = '#000';
  placeholder.style.borderRadius = '8px';
  placeholder.style.display = 'flex';
  placeholder.style.alignItems = 'center';
  placeholder.style.justifyContent = 'center';
  placeholder.innerHTML = `<button class="btn">Load player</button>`;
  playerWrap.innerHTML = '';
  playerWrap.appendChild(placeholder);
  placeholder.querySelector('button').addEventListener('click', () => {
    const iframe = document.createElement('iframe');
    iframe.src = `https://www.youtube.com/embed/${id}?autoplay=1&rel=0`;
    iframe.allow = 'autoplay; encrypted-media';
    iframe.frameBorder = '0';
    iframe.allowFullscreen = true;
    iframe.style.width = '100%';
    iframe.style.height = '520px';
    playerWrap.innerHTML = '';
    playerWrap.appendChild(iframe);
  });
}

async function renderPlaylists() {
  const container = document.querySelector('.playlist-grid');
  if(!container) return;
  container.innerHTML = '';
  const playlists = await fetchPlaylistsCached().catch(() => []);
  if(!playlists || playlists.length === 0) {
    container.innerHTML = `<div class="about-card">No public playlists found.</div>`;
    return;
  }
  const frag = document.createDocumentFragment();
  playlists.forEach(pl => {
    const card = document.createElement('div');
    card.className = 'playlist-card';
    card.innerHTML = `<iframe src="https://www.youtube.com/embed?listType=playlist&list=${pl.id}" frameborder="0" allowfullscreen></iframe>
                      <div class="playlist-title">${escapeHtml(pl.title)}</div>`;
    frag.appendChild(card);
  });
  container.appendChild(frag);
}

function parseRssXml(xmlText) {
  try {
    const parser = new DOMParser();
    const xml = parser.parseFromString(xmlText, 'application/xml');
    const entries = Array.from(xml.getElementsByTagName('entry') || []);
    return entries.map(e => {
      const vidNode = e.getElementsByTagName('yt:videoId')[0] || e.getElementsByTagName('videoId')[0];
      const id = vidNode ? vidNode.textContent.trim() : (e.getElementsByTagName('id')[0]?.textContent?.split(':').pop() || '');
      const title = e.getElementsByTagName('title')[0]?.textContent || '';
      const published = e.getElementsByTagName('published')[0]?.textContent || '';
      const mediaThumb = e.getElementsByTagName('media:thumbnail')[0];
      const thumbnail = mediaThumb?.getAttribute('url') || `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
      return { id, title, published, thumbnail, description: '' };
    }).filter(v => v.id);
  } catch(e) {
    err('parseRssXml failed', e);
    return [];
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  requestAnimationFrame(() => {
    renderVideosAndUI().catch(e => err('renderVideosAndUI', e));
    initSubscriberCounter().catch(e => err('initSubscriberCounter', e));
    initWatchPage();
    renderPlaylists().catch(e => err('renderPlaylists', e));
  });
});

window._mrSilent = {
  fetchVideosAPINetwork: () => fetchVideosAPI(50),
  fetchVideoDetails: async (ids) => {
    if(!ids || !ids.length) return {};
    const url = `${VIDEOS_ENDPOINT}?part=contentDetails&id=${ids.join(',')}&key=${API_KEY}`;
    try {
      const res = await fetchJson(url);
      const map = {};
      (res.items || []).forEach(it => map[it.id] = it.contentDetails?.duration || '');
      return map;
    } catch(e) { return {}; }
  }
};
