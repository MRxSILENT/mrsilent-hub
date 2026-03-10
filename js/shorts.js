/* shorts.js
   Vertical Shorts viewer. Uses the same RSS feed and renders videos in a vertical, swipeable layout.
   Note: RSS doesn't mark "shorts" explicitly. This viewer shows recent uploads in a vertical format.
*/

(async function(){
  const CHANNEL_ID = window.CHANNEL_ID || 'UCKQ_q75TKeAcYXYeu0uaWlQ';
  const RSS_URL = window._mrSilent?.RSS_URL || `https://www.youtube.com/feeds/videos.xml?channel_id=${CHANNEL_ID}`;
  const fetchWithFallback = window._mrSilent?.fetchWithFallback;
  const parseRSS = window._mrSilent?.parseRSS;

  const container = document.getElementById('shorts-viewer');
  if(!container) return;

  try{
    const xml = await fetchWithFallback(RSS_URL);
    const videos = parseRSS(xml);

    // For a more "shorts-like" feel, we will show the latest videos in full-screen vertical cards.
    videos.slice(0,20).forEach(v=>{
      const item = document.createElement('div');
      item.className = 'short-item';
      // Use embed with modestbranding and playsinline; autoplay muted for preview
      const iframe = document.createElement('iframe');
      iframe.className = 'short-iframe';
      iframe.src = `https://www.youtube.com/embed/${v.id}?rel=0&playsinline=1&autoplay=0&controls=1`;
      iframe.allow = 'autoplay; encrypted-media';
      iframe.frameBorder = '0';
      iframe.loading = 'lazy';

      // overlay title
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

  }catch(err){
    console.error('Shorts load failed', err);
    container.innerHTML = `<div class="about-card">Unable to load shorts feed.</div>`;
  }

  /* small helpers (copied) */
  function formatDate(iso){
    if(!iso) return '';
    const d = new Date(iso);
    return d.toLocaleDateString();
  }
  function escapeHtml(s){ return s.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
})();
