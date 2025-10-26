// Use this URL to fetch NASA APOD JSON data.
const apodData = 'https://cdn.jsdelivr.net/gh/GCA-Classroom/apod/data.json';

// Organized script: helpers, DOM, modal builder, renderers, init
const Helpers = {
  esc: s => String(s||'').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])),
  isArray: a => Array.isArray(a) && a.length > 0
};

// Video helpers
Helpers.youtubeId = url => {
  if (!url) return null;
  // common YouTube URL patterns
  const patterns = [
    /(?:youtube\.com\/.+v=|youtube\.com\/watch\?.*v=)([A-Za-z0-9_-]{11})/,
    /(?:youtu\.be\/)([A-Za-z0-9_-]{11})/,
    /(?:youtube\.com\/embed\/)([A-Za-z0-9_-]{11})/
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m && m[1]) return m[1];
  }
  try {
    const u = new URL(url);
    const v = u.searchParams.get('v');
    if (v && v.length >= 6) return v; // best-effort
  } catch (e) {}
  return null;
};

Helpers.youtubeEmbed = id => id ? `https://www.youtube.com/embed/${id}` : null;

const DOM = {
  btn: () => document.getElementById('getImageBtn'),
  gallery: () => document.getElementById('gallery')
};

// Did-you-know facts (pick one at random on load)
const Facts = [
  'Venus spins backward: on Venus the Sun rises in the west and sets in the east.',
  'A day on Venus is longer than a year on Venus.',
  'There are more stars in the universe than grains of sand on all the world\'s beaches.',
  'Neutron stars can spin at a rate of 600 rotations per second.',
  'One teaspoon of a neutron star would weigh about 6 billion tons on Earth.',
  'Jupiter has the shortest day of all the planets — it rotates once every ~10 hours.',
  'Saturn would float in water because it\'s mostly made of gas and is less dense than water.',
  'The footprints on the Moon will likely remain for millions of years because there is no wind to erode them.'
];

function showRandomFact() {
  const gallery = DOM.gallery();
  if (!gallery) return;
  const idx = Math.floor(Math.random() * Facts.length);
  const fact = Facts[idx];
  const el = document.createElement('section');
  el.id = 'didYouKnow';
  el.className = 'did-you-know';
  el.innerHTML = `<h3>Did you know?</h3><p>${Helpers.esc(fact)}</p>`;
  gallery.parentNode.insertBefore(el, gallery);
}

let modal = null;

function showLoading() { DOM.gallery().innerHTML = '<div class="placeholder">🔄 Loading space photos…</div>'; }
function showPlaceholder(msg) { DOM.gallery().innerHTML = `<div class="placeholder">${Helpers.esc(msg)}</div>`; }

async function fetchData() {
  showLoading();
  try {
    const res = await fetch(apodData);
    if (!res.ok) throw new Error(res.status);
    const data = await res.json();
    renderGallery(data);
  } catch (e) {
    console.error(e);
    showPlaceholder('⚠️ Failed to load images. Try again later.');
  }
}

function renderGallery(items) {
  if (!Helpers.isArray(items)) { showPlaceholder('No images found.'); return; }
  const gallery = DOM.gallery(); gallery.innerHTML = '';
  items.forEach(item => gallery.appendChild(createCard(item)));
}

function createCard(item) {
  const card = document.createElement('article'); card.className = 'gallery-item'; card.tabIndex = 0;
  const mediaWrap = document.createElement('div'); mediaWrap.className = 'media-wrap';

  if (item.media_type === 'image') {
    const img = document.createElement('img'); img.src = item.url || item.hdurl || ''; img.alt = item.title || 'NASA image'; mediaWrap.appendChild(img);
  } else if (item.media_type === 'video') {
    // prefer explicit thumbnail; fall back to YouTube thumbnail if possible
    let thumb = item.thumbnail_url || '';
    const yid = Helpers.youtubeId(item.url);
    if (!thumb && yid) thumb = `https://img.youtube.com/vi/${yid}/hqdefault.jpg`;
    const img = document.createElement('img'); img.src = thumb || ''; img.alt = item.title || 'NASA video'; mediaWrap.appendChild(img);
    // add a simple visual play indicator
    const play = document.createElement('div'); play.className = 'video-play-overlay'; play.innerHTML = '▶'; mediaWrap.appendChild(play);
  } else {
    const d = document.createElement('div'); d.textContent = 'Unsupported media type'; mediaWrap.appendChild(d);
  }

  card.appendChild(mediaWrap);
  const p = document.createElement('p'); p.innerHTML = `<strong>${Helpers.esc(item.title)}</strong><br/><small>${Helpers.esc(item.date)}</small>`; card.appendChild(p);
  card.addEventListener('click', () => openModal(item));
  card.addEventListener('keydown', e => { if (e.key === 'Enter') openModal(item); });
  return card;
}

function buildModal() {
  const overlay = document.createElement('div'); overlay.className = 'modal-overlay hidden';
  overlay.innerHTML = `
    <div class="modal" role="dialog" aria-modal="true">
      <button class="modal-close" aria-label="Close">×</button>
      <div class="modal-body">
        <div class="modal-media"></div>
        <div class="modal-details">
          <h2 class="modal-title"></h2>
          <p class="modal-date"></p>
          <p class="modal-explanation"></p>
        </div>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  overlay.addEventListener('click', e => { if (e.target === overlay) closeModal(); });
  overlay.querySelector('.modal-close').addEventListener('click', closeModal);
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });
  return overlay;
}

function openModal(item) {
  if (!modal) modal = buildModal();
  const media = modal.querySelector('.modal-media');
  modal.querySelector('.modal-title').textContent = item.title || '';
  modal.querySelector('.modal-date').textContent = item.date || '';
  modal.querySelector('.modal-explanation').textContent = item.explanation || '';
  media.innerHTML = '';

  if (item.media_type === 'image') {
    const img = document.createElement('img'); img.className = 'modal-image'; img.src = item.hdurl || item.url || ''; img.alt = item.title || ''; media.appendChild(img);
  } else if (item.media_type === 'video') {
    // Prefer showing a thumbnail + a clear external link to avoid iframe/player issues
    const yid = Helpers.youtubeId(item.url);
    let thumb = item.thumbnail_url || '';
    if (!thumb && yid) thumb = `https://img.youtube.com/vi/${yid}/hqdefault.jpg`;
    if (thumb) {
      const img = document.createElement('img'); img.className = 'modal-image'; img.src = thumb; img.alt = item.title || '';
      media.appendChild(img);
    }

    // Prefer opening the YouTube watch page (more likely to succeed) but fall back to provided URL
    const watchUrl = (yid ? `https://www.youtube.com/watch?v=${yid}` : item.url) || item.url;
    const btn = document.createElement('a');
    btn.className = 'watch-button';
    btn.href = watchUrl;
    btn.target = '_blank';
    btn.rel = 'noopener';
    btn.textContent = 'Watch on YouTube';
    media.appendChild(btn);
    // If no thumbnail and no url, show fallback text
    if (!thumb && !item.url) {
      const t = document.createElement('div'); t.textContent = 'Video unavailable'; media.appendChild(t);
    }
    // Also include a plain link in the details if explanation should reference it
  }

  modal.classList.remove('hidden'); document.body.style.overflow = 'hidden';
}

function closeModal() {
  if (!modal) return;
  const iframe = modal.querySelector('iframe'); if (iframe) iframe.src = '';
  modal.classList.add('hidden'); document.body.style.overflow = '';
}

function init() { DOM.btn().addEventListener('click', fetchData); }

document.addEventListener('DOMContentLoaded', init);
// show a random fact once on load
document.addEventListener('DOMContentLoaded', showRandomFact);