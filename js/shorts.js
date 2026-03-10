/* js/shorts.js
   Vertical Shorts viewer using YouTube Data API to detect shorts (duration <= 60s).
   Falls back to RSS feed if API fails.
*/

(async function(){
  const CHANNEL_ID = window.CHANNEL_ID || 'UCKQ_q75TKeAcYXYeu0uaWlQ';
  const API_KEY = (function(){
    // read API key from main script if available
    try{ return window.API_KEY || null; }catch(e){ return null; }
  })() || 'AIzaSyAEBSwFQQHGdg7EdKTWXaBvl6b6cOhFpXc';

  const container = document.getElementById('shorts-viewer');
  if(!container) return;

  function escapeHtml(s){ return String(s || '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
  function formatDate(iso){ if(!iso) return ''; const d = new Date(iso); return d.toLocaleDateString(); }

  /* Helper: ISO 8601 duration to seconds */
  function isoDurationToSeconds(iso){
    // e.g. PT1M30S, PT45S, PT2H3M
    const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
    if(!m) return 0;
    const h = parseInt(m[1]||0,10);
    const mm = parseInt(m[2]||0,10);
    const s = parseInt(m[3]||0,10);
    return h*3600 + mm*60 + s;
  }

  /* Try API: fetch recent videos, then fetch details to filter shorts */
  async function loadShortsFromAPI(){
    try{
      const searchUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=${CHANNEL_ID}&order=date&type=video&maxResults=50&key=${API_KEY}`;
      const res = await fetch(searchUrl);
      if(!res.ok) throw new Error('search API failed ' + res.status);
      const data = await res.json();
      const ids = (data.items || []).map(i => i.id?.videoId).filter(Boolean);
      if(ids.length === 0) return [];

      // fetch contentDetails for durations
      const chunkSize = 50;
      const details = {};
      for(let i=0;i<ids.length;i+=chunkSize){
        const chunk = ids.slice(i,i+chunkSize).join(',');
        const vUrl = `https://www.googleapis.com/youtube/v3/videos?part=contentDetails,snippet&id=${chunk}&key=${API_KEY}`;
        const r2 = await fetch(vUrl);
        if(!r2.ok) throw new Error('videos API failed ' + r2.status);
        const d2 = await r2.json();
        (d2.items || []).forEach(it => {
          details[it.id] = {
            duration: it.contentDetails?.duration || '',
            title: it.snippet?.title || '',
            published: it.snippet?.publishedAt || '',
            thumbnail: it.snippet?.thumbnails?.maxres?.url || it.snippet?.thumbnails?.high?.url || `https://i.ytimg.com/vi/${it.id}/hqdefault.jpg`
          };
        });
      }

      // filter shorts (<= 60s)
      const shorts = Object.keys(details).map(id => {
        const d = details[id];
        const seconds = isoDurationToSeconds(d.duration);
        return { id, title: d.title, published: d.published, thumbnail: d.thumbnail, seconds };
      }).filter(v => v.seconds > 0 && v.seconds <= 60);

      // sort by published desc
      shorts.sort((a,b) => new Date(b.published) - new Date(a.published));
      return shorts;
    }catch(e){
      console.warn('Shorts API load failed', e);
      return null; // signal fallback
    }
  }

  /* RSS fallback: show recent uploads (can't reliably detect shorts) */
  async function loadShortsFromRss(){
    try{
      const rssUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent('https://www.youtube.com/feeds/videos.xml?channel_id=' + CHANNEL_ID)}`;
      const res = await fetch(rssUrl);
      if(!res.ok) throw new Error('RSS proxy failed ' + res.status);
      const text = await res.text();
      const parser = new DOMParser();
      const xml = parser.parseFromString(text, 'application/xml');
      const entries = Array.from(xml.getElementsByTagName('entry') || []).slice(0,20);
      const videos = entries.map(e => {
        const vidNode = e.getElementsByTagName('yt:videoId')[0] || e.getElementsByTagName('videoId')[0];
        const id = vidNode ? vidNode.textContent.trim() : (e.getElementsByTagName('id')[0]?.textContent?.split(':').pop() || '');
        const title = e.getElementsByTagName('title')[0]?.textContent || '';
        const published = e.getElementsByTagName('published')[0]?.textContent || '';
        const mediaThumb = e.getElementsByTagName('media:thumbnail')[0];
        const thumbnail = mediaThumb?.getAttribute('url') || `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
        return { id, title, published, thumbnail };
      }).filter(v => v.id);
      return videos;
    }catch(e){
      console.error('Shorts RSS fallback failed', e);
      return [];
    }
  }

  /* Render vertical shorts feed */
  function renderShorts(shorts){
    container.innerHTML = '';
    if(!shorts || shorts.length === 0){
      container.innerHTML = `<div class="about-card">No shorts available right now.</div>`;
      return;
    }
    shorts.forEach(v=>{
      const item = document.createElement('div');
      item.className = 'short-item';
      const iframe = document.createElement('iframe');
      iframe.className = 'short-iframe';
      iframe.src = `https://www.youtube.com/embed/${v.id}?rel=0&playsinline=1`;
      iframe.allow = 'autoplay; encrypted-media';
      iframe.frameBorder = '0';
      iframe.loading = 'lazy';

      const overlay = document.createElement('div');
      overlay.style.position = 'absolute';
      overlay.style.left = '20px';
      overlay.style.bottom = '40px';
      overlay.style.maxWidth = '60%';
      overlay.style.color = '#eaf6fb';
      overlay.style.textShadow = '0 2px 8px rgba(0,0,0,0.6)';
      overlay.innerHTML = `<div style="font-weight:700;font-size:16px">${escapeHtml(v.title)}</div>
                           <div style="color:var(--muted);font-size:13px">${formatDate(v.published)}</div>`;

      item.appendChild(iframe);
      item.appendChild(overlay);

      // clicking the short opens watch page
      item.addEventListener('click', ()=> location.href = `watch.html?id=${v.id}`);

      container.appendChild(item);
    });
  }

  // Load shorts: try API first
  let shorts = await loadShortsFromAPI();
  if(shorts === null){
    // API failed -> fallback to RSS (can't detect duration reliably)
    const rss = await loadShortsFromRss();
    renderShorts(rss);
  }else{
    renderShorts(shorts);
  }

})();
