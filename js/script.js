/* script.js
   Core site logic: fetch RSS feed, render video cards, search, watch page loader, subscriber counter.
   Optional: set API_KEY to a valid YouTube Data API v3 key to enable real subscriber count.
*/

/* CONFIG */
const API_KEY = ''; // <-- OPTIONAL: Add your YouTube Data API v3 key here to enable real subscriber count
const CHANNEL_ID = window.CHANNEL_ID || 'UCKQ_q75TKeAcYXYeu0uaWlQ';
const RSS_URL = `https://www.youtube.com/feeds/videos.xml?channel_id=${CHANNEL_ID}`;
const CORS_FALLBACK = url => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`;

/* Utility: fetch with CORS fallback */
async function fetchWithFallback(url){
  try{
    const res = await fetch(url, {mode:'cors'});
    if(!res.ok) throw new Error('CORS or network error');
    return await res.text();
  }catch(e){
    // fallback to public CORS proxy
    const fallback = CORS_FALLBACK(url);
    const res2 = await fetch(fallback);
    if(!res2.ok) throw new Error('Fallback failed');
    return await res2.text();
  }
}

/* Parse RSS XML and return array of videos */
function parseRSS(xmlText){
  const parser = new DOMParser();
  const xml = parser.parseFromString(xmlText, 'application/xml');
  const entries = Array.from(xml.querySelectorAll('entry'));
  return entries.map(e => {
    const id = e.querySelector('yt\\:videoId')?.textContent || e.querySelector('id')?.textContent?.split(':').pop();
    const title = e.querySelector('title')?.textContent || '';
    const published = e.querySelector('published')?.textContent || '';
    const link = e.querySelector('link')?.getAttribute('href') || `https://www.youtube.com/watch?v=${id}`;
    const thumbnail = `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
    const description = e.querySelector('media\\:description')?.textContent || '';
    return {id,title,published,link,thumbnail,description};
  });
}

/* Render video card */
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

/* Helpers */
function formatDate(iso){
  if(!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString();
}
function escapeHtml(s){ return s.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

/* Load and render latest videos (for index) */
async function loadLatestVideos(limit=8){
  try{
    const xml = await fetchWithFallback(RSS_URL);
    const videos = parseRSS(xml);
    const grid = document.getElementById('videos-grid') || document.getElementById('videos-grid-all');
    if(!grid) return videos;
    grid.innerHTML = '';
    videos.slice(0,limit).forEach(v => grid.appendChild(createVideoCard(v)));
    // trending: pick top 3 by recency
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

    // For videos.html full list
    const allGrid = document.getElementById('videos-grid-all');
    if(allGrid){
      allGrid.innerHTML = '';
      videos.forEach(v => allGrid.appendChild(createVideoCard(v)));
      // Load more button hides (we already show all)
      const loadMore = document.getElementById('load-more-wrap');
      if(loadMore) loadMore.style.display = 'none';
    }

    // Up next for watch page
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

    // About page: channel description (if present in feed)
    const descEl = document.getElementById('channel-description');
    if(descEl){
      // RSS feed doesn't include channel description reliably; show placeholder
      descEl.textContent = 'Welcome to Mr. Si!ent — gaming content focused on Minecraft, Roblox, and ARK Survival. Subscribe for gameplay, tutorials, and live streams.';
    }

    // For search inputs
    attachSearchHandlers(videos);

    return videos;
  }catch(err){
    console.error('Failed to load videos', err);
    const grid = document.getElementById('videos-grid') || document.getElementById('videos-grid-all');
    if(grid) grid.innerHTML = `<div class="about-card">Unable to load videos. Try again later.</div>`;
    return [];
  }
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
    const filtered = videos.filter(v => v.title.toLowerCase().includes(q) || v.description.toLowerCase().includes(q));
    if(filtered.length === 0){
      grid.innerHTML = `<div class="about-card">No videos found for "${escapeHtml(q)}".</div>`;
    }else{
      filtered.forEach(v => grid.appendChild(createVideoCard(v)));
    }
  });
}

/* Subscriber counter (animated). Uses YouTube Data API if API_KEY is set. */
async function initSubscriberCounter(){
  const el = document.getElementById('subscriber-counter') || document.getElementById('subscriber-counter-2');
  if(!el) return;
  if(API_KEY && API_KEY.trim().length>0){
    try{
      const url = `https://www.googleapis.com/youtube/v3/channels?part=statistics&id=${CHANNEL_ID}&key=${API_KEY}`;
      const res = await fetch(url);
      const data = await res.json();
      const subs = data.items?.[0]?.statistics?.subscriberCount || null;
      if(subs){
        animateNumber(el, Number(subs));
        return;
      }
    }catch(e){
      console.warn('YouTube API failed', e);
    }
  }
  // Fallback: animated placeholder value from data-placeholder attribute or default
  const placeholder = el.getAttribute('data-placeholder') || '12.3K';
  el.textContent = `${placeholder} subscribers`;
}

/* Animate number to target */
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
function formatCompact(n){
  if(n >= 1_000_000) return (n/1_000_000).toFixed(1).replace(/\.0$/,'') + 'M';
  if(n >= 1_000) return (n/1_000).toFixed(1).replace(/\.0$/,'') + 'K';
  return String(n);
}

/* Watch page loader: reads ?id=VIDEO_ID and injects iframe */
function initWatchPage(videos){
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

  // Highlight upnext item if present
  const upnext = document.getElementById('upnext');
  if(upnext){
    Array.from(upnext.querySelectorAll('a')).forEach(a=>{
      if(a.href.includes(`id=${id}`) || a.href.includes(`watch?v=${id}`)) a.style.opacity = '0.6';
    });
  }
}

/* Initialize site */
document.addEventListener('DOMContentLoaded', async ()=>{
  // Load videos and render
  const videos = await loadLatestVideos(12);
  // Initialize subscriber counter
  initSubscriberCounter();
  // If on watch page, init player
  initWatchPage(videos);
});

/* Expose for shorts.js to reuse RSS parsing */
window._mrSilent = {
  fetchWithFallback,
  parseRSS,
  RSS_URL,
  CORS_FALLBACK
};
