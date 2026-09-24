/* ============================================
   Undangan Pembeatan — script.js
   ============================================ */

const STORAGE_KEY = 'pembeatan_data_v1';
const UCAPAN_KEY = 'pembeatan_ucapan_v1';

let APP_DATA = null;

/* ---------- Load data: localStorage (admin edits) > data.json (default) ---------- */
async function loadData() {
  // 1. Try localStorage first (set by admin panel, same browser)
  const local = localStorage.getItem(STORAGE_KEY);
  if (local) {
    try {
      APP_DATA = JSON.parse(local);
      return APP_DATA;
    } catch (e) { /* fall through */ }
  }
  // 2. Fallback to data.json (default / exported by admin)
  try {
    const res = await fetch('data.json', { cache: 'no-store' });
    APP_DATA = await res.json();
  } catch (e) {
    console.error('Gagal memuat data.json', e);
    APP_DATA = {};
  }
  return APP_DATA;
}

/* ---------- Populate DOM with data ---------- */
function populateContent(data) {
  const acara = data.acara || {};
  const ortu = data.orangTua || {};
  const sambutan = data.sambutan || {};

  document.title = `Undangan Pembeatan — ${acara.namaAdik || ''}`;

  setText('profileName', acara.namaAdik);
  setText('profileNickname', acara.namaPanggilan ? `"${acara.namaPanggilan}"` : '');
  setText('ayahName', ortu.ayah);
  setText('ibuName', ortu.ibu);
  setText('closingName', acara.namaAdik);

  setText('hariTanggal', acara.hari && acara.tanggalTampil ? `${acara.hari}, ${acara.tanggalTampil}` : acara.tanggalTampil);
  setText('waktuAcara', acara.waktu);
  setText('alamatAcara', acara.alamat);

  setText('ayatText', sambutan.ayat);
  setText('ayatSumber', sambutan.sumberAyat ? `— ${sambutan.sumberAyat}` : '');

  // Cover
  const coverNameEl = document.querySelector('.cover-name');
  if (coverNameEl && acara.namaAdik) {
    coverNameEl.innerHTML = acara.namaAdik.split(' ').reduce((acc, word, i, arr) => {
      // Keep it on roughly 2 lines for nicer display
      return acc + word + (i === Math.ceil(arr.length/2)-1 && arr.length > 2 ? '<br>' : ' ');
    }, '');
  }
  const coverNick = document.querySelector('.cover-nickname');
  if (coverNick && acara.namaPanggilan) coverNick.textContent = `"${acara.namaPanggilan}"`;

  // Map
  if (acara.mapsEmbedUrl) {
    const mapFrame = document.getElementById('mapFrame');
    if (mapFrame) mapFrame.src = acara.mapsEmbedUrl;
  }
  const mapsLink = document.getElementById('mapsLink');
  if (mapsLink) {
    const query = encodeURIComponent(acara.mapsQuery || acara.alamat || '');
    mapsLink.href = (acara.mapsLat != null && acara.mapsLng != null)
      ? `https://www.google.com/maps/search/?api=1&query=${acara.mapsLat},${acara.mapsLng}`
      : `https://www.google.com/maps/search/?api=1&query=${query}`;
  }

  // Music
  if (data.musik && data.musik.url) {
    const audio = document.getElementById('bgMusic');
    audio.src = data.musik.url;
    document.getElementById('musicToggle').classList.add('visible');
  }

  // Gallery
  renderGallery(data.galeri || []);

  // Guest name from URL param
  applyGuestName();
}

function setText(id, value) {
  const el = document.getElementById(id);
  if (el && value) el.textContent = value;
}

/* ---------- Guest personalization via ?to= ---------- */
function applyGuestName() {
  const params = new URLSearchParams(window.location.search);
  const guest = params.get('to') || params.get('kepada');
  if (guest) {
    const decoded = decodeURIComponent(guest.replace(/\+/g, ' '));
    const el = document.getElementById('guestName');
    if (el) el.textContent = decoded;
  }
}

/* ---------- Gallery ---------- */
function renderGallery(items) {
  const grid = document.getElementById('galleryGrid');
  if (!grid) return;
  grid.innerHTML = '';
  const valid = items.filter(it => it && (it.url || it.caption));
  const list = valid.length ? valid : items;

  list.forEach(item => {
    const div = document.createElement('div');
    div.className = 'gallery-item';
    if (item.url) {
      const img = document.createElement('img');
      img.src = item.url;
      img.alt = item.caption || 'Foto';
      img.loading = 'lazy';
      div.appendChild(img);
    } else {
      const ph = document.createElement('div');
      ph.className = 'gallery-placeholder';
      ph.textContent = item.caption || 'Foto menyusul';
      div.appendChild(ph);
    }
    grid.appendChild(div);
  });
}

/* ---------- Countdown ---------- */
function startCountdown(tanggalISO, waktu) {
  const target = parseTargetDate(tanggalISO, waktu);
  if (!target) return;

  function tick() {
    const now = new Date();
    let diff = target - now;
    if (diff < 0) diff = 0;

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
    const mins = Math.floor((diff / (1000 * 60)) % 60);
    const secs = Math.floor((diff / 1000) % 60);

    setText('cdDays', String(days).padStart(2, '0'));
    setText('cdHours', String(hours).padStart(2, '0'));
    setText('cdMins', String(mins).padStart(2, '0'));
    setText('cdSecs', String(secs).padStart(2, '0'));
  }
  tick();
  setInterval(tick, 1000);
}

function parseTargetDate(iso, waktu) {
  if (!iso) return null;
  // waktu like "11:00 WITA - Selesai" -> extract HH:MM, WITA = UTC+8
  let hh = 0, mm = 0;
  const match = (waktu || '').match(/(\d{1,2}):(\d{2})/);
  if (match) { hh = parseInt(match[1], 10); mm = parseInt(match[2], 10); }
  // Treat as WITA (UTC+8)
  const [y, mo, d] = iso.split('-').map(Number);
  const utcMillis = Date.UTC(y, mo - 1, d, hh - 8, mm);
  return new Date(utcMillis);
}

/* ---------- Ucapan (RSVP / Guestbook) ---------- */
function loadUcapan() {
  const fromLocal = JSON.parse(localStorage.getItem(UCAPAN_KEY) || '[]');
  const fromData = (APP_DATA && APP_DATA.ucapan) || [];
  // merge, local first (most recent), dedupe not critical here
  return [...fromLocal, ...fromData];
}

function renderUcapan() {
  const list = loadUcapan();
  const container = document.getElementById('ucapanList');
  if (!container) return;
  container.innerHTML = '';

  if (!list.length) {
    container.innerHTML = '<p class="ucapan-empty">Jadilah yang pertama mengirimkan doa &amp; ucapan.</p>';
    return;
  }

  list.forEach(item => {
    const card = document.createElement('div');
    card.className = 'ucapan-card';
    const name = document.createElement('p');
    name.className = 'ucapan-card-name';
    name.textContent = item.nama;
    const msg = document.createElement('p');
    msg.className = 'ucapan-card-msg';
    msg.textContent = item.pesan;
    card.appendChild(name);
    card.appendChild(msg);
    container.appendChild(card);
  });
}

function setupUcapanForm() {
  const form = document.getElementById('ucapanForm');
  if (!form) return;
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const nama = document.getElementById('ucapanNama').value.trim();
    const pesan = document.getElementById('ucapanPesan').value.trim();
    if (!nama || !pesan) return;

    const existing = JSON.parse(localStorage.getItem(UCAPAN_KEY) || '[]');
    existing.unshift({ nama, pesan, waktu: new Date().toISOString() });
    localStorage.setItem(UCAPAN_KEY, JSON.stringify(existing));

    form.reset();
    renderUcapan();
  });
}

/* ---------- Music toggle ---------- */
function setupMusic() {
  const btn = document.getElementById('musicToggle');
  const audio = document.getElementById('bgMusic');
  if (!btn || !audio) return;

  btn.addEventListener('click', () => {
    if (!audio.src) return;
    if (audio.paused) {
      audio.play().catch(() => {});
      btn.classList.add('playing');
    } else {
      audio.pause();
      btn.classList.remove('playing');
    }
  });
}

function tryAutoplayOnOpen() {
  const audio = document.getElementById('bgMusic');
  const btn = document.getElementById('musicToggle');
  if (audio && audio.src) {
    audio.play().then(() => btn.classList.add('playing')).catch(() => {
      // autoplay blocked, user can tap the button
    });
  }
}

/* ---------- Cover open gate ---------- */
function setupCoverGate() {
  const cover = document.getElementById('cover');
  const openBtn = document.getElementById('openBtn');
  if (!openBtn) return;
  openBtn.addEventListener('click', () => {
    cover.classList.add('is-closed');
    document.body.style.overflow = '';
    tryAutoplayOnOpen();
  });
  document.body.style.overflow = 'hidden';
}

/* ---------- Scroll reveal ---------- */
function setupScrollReveal() {
  const items = document.querySelectorAll('[data-animate]');
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('in-view');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.15, rootMargin: '0px 0px -40px 0px' });
  items.forEach(el => observer.observe(el));
}

/* ---------- Init ---------- */
(async function init() {
  const data = await loadData();
  populateContent(data);

  const acara = data.acara || {};
  startCountdown(acara.tanggal, acara.waktu);

  renderUcapan();
  setupUcapanForm();
  setupMusic();
  setupCoverGate();
  setupScrollReveal();
})();
