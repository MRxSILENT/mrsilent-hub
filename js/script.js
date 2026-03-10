/* js/script.js
   YouTube Data API primary + RSS fallback script.
   - Uses YouTube Data API v3 to fetch latest videos, subscriber count, and playlists.
   - Falls back to RSS for videos only if API fails.
   - Designed for static hosting (GitHub Pages).
   - NOTE: Restrict your API key to your GitHub Pages domain in Google Cloud Console.
*/

/* ========== CONFIG ========== */
const API_KEY = 'AIzaSyAEBSwFQQHGdg7EdKTWXaBvl6b6cOhFpXc'; // <-- your provided key
const CHANNEL_ID = window.CHANNEL_ID || 'UCKQ_q75TKeAcYXYeu0uaWlQ';

/* YouTube Data API endpoints */
const YT_BASE = 'https://www.googleapis.com/youtube/v3';
const SEARCH_ENDPOINT = `${YT_BASE}/search`;
const CHANNELS_ENDPOINT = `${YT_BASE}/channels`;
const VIDEOS_ENDPOINT = `${YT_BASE}/videos`;
const PLAYLISTS_ENDPOINT = `${YT_BASE}/playlists`;

/* RSS fallback (used only if API fails) */
const RSS_URL = `https://www.youtube.com/feeds/videos.xml?channel_id=${CHANNEL_ID}`;
const PROXY = 'https://api.allorigins.win/raw?url=';

/* Utility helpers */
function log(...args){ console.log('[mr-silent]', ...args); }
function err(...args){ console.error('[mr-silent]', ...args); }
function escapeHtml(s){ return String(s || '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function formatDate(iso){ if(!iso) return ''; const d = new Date(iso); return d.toLocaleDateString(); }
function formatCompact(n){ if(n>=1_000_000) return (n/1_000_000).toFixed(1).replace(/\.0$/,'')+'M'; if(n>=1000) return (n/1000).toFixed(1).replace(/\.0$/,'')+'K'; return String(n); }

/* Create video card */
function createVideoCard(video){
  const a = document.createElement('a');
  a.className = 'video-card';
  a.href = `watch.html?id=${video.id}`;
  a.innerHTML = `
    <img class="thumb" loading="lazy" src="${video.thumbnail}" alt="${escapeHtml(video.title)}" />
    <div class="video-info">
      <h3 class="video-title">${escapeHtml(video.title)}</h3>
      <div class="video-meta">${formatDate(video.published)}</div>
    </div>
  `;
  return a;
}

/* ========== YouTube Data API functions ========== */

/* Fetch subscriber count via channels.list */
async function fetchSubscriberCount(){
  try{
    const url = `${CHANNELS_ENDPOINT}?part=statistics&id=${CHANNEL_ID}&key=${API_KEY}`;
    const res = await fetch(url);
    if(!res.ok) throw new Error(`YT channels API ${res.status}`);
    const data = await res.json();
    const subs = Number(data.items?.[0]?.statistics?.subscriberCount || 0);
    log('Subscriber count from API', subs);
    return subs;
  }catch(e){
    err('fetchSubscriberCount failed', e);
    throw e;
  }
}

/* Fetch latest videos via search.list (returns up to maxResults) */
async function fetchLatestVideosFromAPI(maxResults = 50){
  try{
    const url = `${SEARCH_ENDPOINT}?part=snippet&channelId=${CHANNEL_ID}&order=date&type=video&maxResults=${maxResults}&key=${API_KEY}`;
    const res = await fetch(url);
    if(!res.ok) throw new Error(`YT search API ${res.status}`);
    const data = await res.json();
    const videos = (data.items || []).map(item => {
      const id = item.id?.videoId;
      const snip = item.snippet || {};
      const thumbnail = snip.thumbnails?.high?.url || snip.thumbnails?.default?.url || `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
      return {
        id,
        title: snip.title || '',
        published: snip.publishedAt || '',
        thumbnail,
        description: snip.description || ''
      };
    }).filter(v => v.id);
    log('Videos from API', videos.length);
    return videos;
  }catch(e){
    err('fetchLatestVideosFromAPI failed', e);
    throw e;
  }
}

/* Fetch video details (contentDetails) for durations and other metadata */
async function fetchVideoDetails(ids = []){
  if(!ids.length) return [];
  try{
    const url = `${VIDEOS_ENDPOINT}?part=contentDetails,statistics&id=${ids.join(',')}&key=${API_KEY}`;
    const res = await fetch(url);
    if(!res.ok) throw new Error(`YT videos API ${res.status}`);
    const data = await res.json();
    const map = {};
    (data.items || []).forEach(item => {
      map[item.id] = {
        duration: item.contentDetails?.duration || '',
        viewCount: item.statistics?.viewCount || 0
      };
    });
    return map;
  }catch(e){
    err('fetchVideoDetails failed', e);
    return {};
  }
}

/* Fetch playlists for the channel */
async function fetchPlaylistsFromAPI(pageToken = '') {
  try{
    const url = `${PLAYLISTS_ENDPOINT}?part=snippet&channelId=${CHANNEL_ID}&maxResults=50&pageToken=${pageToken}&key=${API_KEY}`;
    const res = await fetch(url);
    if(!res.ok) throw new Error(`YT playlists API ${res.status}`);
    const data = await res.json();
    return data;
  }catch(e){
    err('fetchPlaylistsFromAPI failed', e);
    throw e;
  }
}

/* ========== RSS fallback functions ========== */

async function fetchRssViaProxy(){
  try{
    const proxied = PROXY + encodeURIComponent(RSS_URL);
    const res = await fetch(proxied);
    if(!res.ok) throw new Error(`Proxy RSS ${res.status}`);
    const text = await res.text();
    return text;
  }catch(e){
    err('fetchRssViaProxy failed', e);
    throw e;
  }
}

function parseRssXml(xmlText){
  try{
    const parser = new DOMParser();
    const xml = parser.parseFromString(xmlText, 'application/xml');
    const entries = Array.from(xml.getElementsByTagName('entry') || []);
    const videos = entries.map(e => {
      const vidNode = e.getElementsByTagName('yt:videoId')[0] || e.getElementsByTagName('videoId')[0];
      const id = vidNode ? vidNode.textContent.trim() : (e.getElementsByTagName('id')[0]?.textContent?.split(':').pop() || '');
      const title = e.getElementsByTagName('title')[0]?.textContent || '';
      const published = e.getElementsByTagName('published')[0]?.textContent || '';
      const mediaThumb = e.getElementsByTagName('media:thumbnail')[0];
      const thumbnail = mediaThumb?.getAttribute('url') || `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
      const description = e.getElementsByTagName('media:description')[0]?.textContent || '';
      return { id, title, published, thumbnail, description };
    }).filter(v => v.id);
    log('Videos from RSS', videos.length);
    return videos;
  }catch(e){
    err('parseRssXml failed', e);
    return [];
  }
}

/* ========== Rendering and UI logic ========== */

/* Render videos and UI: tries API first, falls back to RSS */
async function renderVideosAndUI(){
  let videos = [];
  try{
    videos = await fetchLatestVideosFromAPI(50);
  }catch(apiErr){
    log('API videos failed, falling back to RSS', apiErr);
    try{
      const xml = await fetchRssViaProxy();
      videos = parseRssXml(xml);
    }catch(rssErr){
      err('Both API and RSS failed to load videos', rssErr);
      videos = [];
    }
  }

  // Render into grids
  const grid = document.getElementById('videos-grid') || document.getElementById('videos-grid-all');
  if(grid){
    grid.innerHTML = '';
    const list = (grid.id === 'videos-grid') ? videos.slice(0, 12) : videos;
    if(list.length === 0){
      grid.innerHTML = `<div class="about-card">No videos available right now. Check console for details.</div>`;
    }else{
      list.forEach(v => grid.appendChild(createVideoCard(v)));
    }
  }

  // Trending
  const trendingRow = document.getElementById('trending-row');
  if(trendingRow){
    trendingRow.innerHTML = '';
    videos.slice(0,3).forEach(v=>{
      const card = document.createElement('div');
      card.className = 'trending-card';
      card.innerHTML = `<a href="watch.html?id=${v.id}" style="text-decoration:none;color:inherit">
        <img src="${v.thumbnail}" style="width:100%;height:160px;object-fit:cover;border-radius:8px" />
        <h4 style="margin:10px 0 6px;color:var(--accent)">${escapeHtml(v.title)}</h4>
        <div style="color:var(--muted);font-size:13px">${formatDate(v.published)}</div>
      </a>`;
      trendingRow.appendChild(card);
    });
  }

  // Up next
  const upnext = document.getElementById('upnext');
  if(upnext){
    upnext.innerHTML = '';
    videos.slice(0,8).forEach(v=>{
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
      upnext.appendChild(el);
    });
  }

  // Attach search handlers
  attachSearchHandlers(videos);

  return videos;
}

/* Search filtering */
function attachSearchHandlers(videos){
  const input = document.getElementById('search-input') || document.getElementById('search-input-2');
  if(!input) return;
  input.addEventListener('input', e=>{
    const q = e.target.value.trim().toLowerCase();
    const grid = document.getElementById('videos-grid') || document.getElementById('videos-grid-all');
    if(!grid) return;
    grid.innerHTML = '';
    const filtered = videos.filter(v => (v.title + ' ' + v.description).toLowerCase().includes(q));
    if(filtered.length === 0){
      grid.innerHTML = `<div class="about-card">No videos found for "${escapeHtml(q)}".</div>`;
    }else{
      filtered.forEach(v => grid.appendChild(createVideoCard(v)));
    }
  });
}

/* Subscriber counter init */
async function initSubscriberCounter(){
  const el = document.getElementById('subscriber-counter') || document.getElementById('subscriber-counter-2');
  if(!el) return;
  try{
    const subs = await fetchSubscriberCount();
    if(subs && subs > 0){
      animateNumber(el, subs);
      return;
    }
  }catch(e){
    log('Subscriber API failed, using fallback placeholder');
  }
  const placeholder = el.getAttribute('data-placeholder') || '12.3K';
  el.textContent = `${placeholder} subscribers`;
}

/* Animate number */
function animateNumber(el, target){
  const start = 0;
  const duration = 1200;
  const startTime = performance.now();
  function tick(now){
    const t = Math.min(1, (now - startTime) / duration);
    const eased = t*(2-t);
    const current = Math.floor(start + (target - start) * eased);
    el.textContent = formatCompact(current) + ' subscribers';
    if(t < 1) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

/* Watch page loader */
function initWatchPage(){
  const params = new URLSearchParams(location.search);
  const id = params.get('id');
  const playerWrap = document.getElementById('player-wrap');
  if(!playerWrap) return;
  if(!id){
    playerWrap.innerHTML = `<div class="about-card">No video selected. Go to <a href="videos.html">Videos</a>.</div>`;
    return;
  }
  const iframe = document.createElement('iframe');
  iframe.src = `https://www.youtube.com/embed/${id}?autoplay=1&rel=0`;
  iframe.allow = 'autoplay; encrypted-media';
  iframe.frameBorder = '0';
  iframe.allowFullscreen = true;
  playerWrap.innerHTML = '';
  playerWrap.appendChild(iframe);
}

/* ========== Playlists rendering ========== */

/* Render all public playlists on playlists.html */
async function renderPlaylists(){
  const container = document.querySelector('.playlist-grid');
  if(!container) return;
  container.innerHTML = '';

  // Try API to list playlists (may be paginated)
  try{
    let nextPage = '';
    let total = 0;
    do {
      const data = await fetchPlaylistsFromAPI(nextPage);
      nextPage = data.nextPageToken || '';
      (data.items || []).forEach(pl => {
        const id = pl.id;
        const title = pl.snippet?.title || 'Playlist';
        const card = document.createElement('div');
        card.className = 'playlist-card';
        // embed playlist player
        card.innerHTML = `<iframe src="https://www.youtube.com/embed?listType=playlist&list=${id}" frameborder="0" allowfullscreen></iframe>
                          <div class="playlist-title">${escapeHtml(title)}</div>`;
        container.appendChild(card);
        total++;
      });
    } while(nextPage);
    if(total === 0){
      container.innerHTML = `<div class="about-card">No public playlists found for this channel.</div>`;
    }
  }catch(e){
    err('renderPlaylists failed, showing fallback message', e);
    container.innerHTML = `<div class="about-card">Unable to load playlists. Check console for details.</div>`;
  }
}

/* ========== Initialization ========== */
document.addEventListener('DOMContentLoaded', async ()=>{
  try{
    await renderVideosAndUI();
  }catch(e){
    err('renderVideosAndUI error', e);
  }
  try{
    await initSubscriberCounter();
  }catch(e){
    err('initSubscriberCounter error', e);
  }
  try{
    initWatchPage();
  }catch(e){
    err('initWatchPage error', e);
  }
  try{
    await renderPlaylists();
  }catch(e){
    err('renderPlaylists error', e);
  }
});

/* Expose for shorts.js */
window._mrSilent = {
  fetchRssViaProxy,
  parseRssXml,
  RSS_URL,
  fetchLatestVideosFromAPI,
  fetchVideoDetails
};
