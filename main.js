// ============================================================
//  Sitio público - lee directamente de Supabase (RLS: lectura pública)
// ============================================================
import { api } from './supabase/supabaseClient.js';

const $ = (sel) => document.querySelector(sel);

function toast(msg, type = 'info') {
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = msg;
  $('#toast-container').appendChild(el);
  setTimeout(() => el.remove(), 3500);
}

// ---------- Modo oscuro ----------
function initTheme() {
  const saved = localStorage.getItem('theme');
  if (saved === 'dark') document.documentElement.setAttribute('data-theme', 'dark');
  updateThemeButtons(saved === 'dark');
}

function updateThemeButtons(isDark) {
  const btn = $('#themeToggleDesktop');
  const btnMobile = $('#themeToggle');
  if (btn) btn.textContent = isDark ? '☀️' : '🌙';
  if (btnMobile) btnMobile.textContent = isDark ? '☀️' : '🌙';
}

function toggleTheme() {
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  if (isDark) {
    document.documentElement.removeAttribute('data-theme');
    localStorage.setItem('theme', 'light');
    updateThemeButtons(false);
  } else {
    document.documentElement.setAttribute('data-theme', 'dark');
    localStorage.setItem('theme', 'dark');
    updateThemeButtons(true);
  }
}

$('#themeToggleDesktop')?.addEventListener('click', toggleTheme);
$('#themeToggle')?.addEventListener('click', toggleTheme);

// ---------- Menú móvil ----------
const menuToggle = $('#menuToggle');
const mobileMenuPanel = $('#navLinks');
const mobileMenuOverlay = $('#mobileMenuOverlay');
const mobileMenuClose = $('#mobileMenuClose');

function openMobileMenu() {
  mobileMenuPanel.classList.add('open');
  mobileMenuOverlay.classList.add('active');
  menuToggle.setAttribute('aria-expanded', 'true');
  document.body.style.overflow = 'hidden';
  mobileMenuClose.focus();
}

function closeMobileMenu() {
  mobileMenuPanel.classList.remove('open');
  mobileMenuOverlay.classList.remove('active');
  menuToggle.setAttribute('aria-expanded', 'false');
  document.body.style.overflow = '';
  menuToggle.focus();
}

menuToggle?.addEventListener('click', () => {
  if (mobileMenuPanel.classList.contains('open')) {
    closeMobileMenu();
  } else {
    openMobileMenu();
  }
});

mobileMenuClose?.addEventListener('click', closeMobileMenu);

mobileMenuOverlay?.addEventListener('click', closeMobileMenu);

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && mobileMenuPanel?.classList.contains('open')) {
    closeMobileMenu();
  }
});

mobileMenuPanel?.addEventListener('click', (e) => {
  if (e.target.tagName === 'A') {
    closeMobileMenu();
  }
});

// ---------- Año del footer ----------
$('#year').textContent = new Date().getFullYear();

// ---------- Cargar ANUNCIOS ----------
async function loadAnnouncements() {
  const data = await api.announcements();
  const grid = $('#announceGrid');
  if (!data.length) { grid.innerHTML = '<p>No hay anuncios por el momento.</p>'; return; }
  grid.innerHTML = data.map((a) => `
    <article class="announce-card ${a.is_urgent ? 'urgent' : ''}">
      ${a.is_urgent ? '<span class="badge">URGENTE</span>' : ''}
      <h3>${esc(a.title)}</h3>
      <p>${esc(a.body)}</p>
      <p class="date">📅 Publicado: ${a.published_at || ''}</p>
    </article>`).join('');
}

// ---------- Cargar INFO DEL PROGRAMA ----------
const ICONS = { history: '📜', objectives: '🎯', benefits: '🌟', activities: '🛠️' };
async function loadProgramInfo() {
  const data = await api.programInfo();
  const grid = $('#infoGrid');
  grid.innerHTML = data.map((i) => `
    <div class="info-card reveal">
      <div class="icon">${ICONS[i.section] || '✨'}</div>
      <h3>${esc(i.title)}</h3>
      <p>${esc(i.content)}</p>
    </div>`).join('');
  observeReveals();
}

// ---------- Cargar REQUISITOS ----------
async function loadRequirements() {
  const data = await api.requirements();
  const labels = { documents: 'Documentos necesarios', criteria: 'Criterios de selección', dates: 'Fechas de inscripción' };
  const groups = {};
  data.forEach((r) => { (groups[r.category] = groups[r.category] || []).push(r); });
  const cols = $('#reqCols');
  cols.innerHTML = Object.keys(groups).map((cat) => `
    <div class="req-block reveal">
      <h3>${labels[cat] || cat}</h3>
      <ul>${groups[cat].map((r) => `<li><strong>${esc(r.title)}</strong>${r.description ? ' — ' + esc(r.description) : ''}</li>`).join('')}</ul>
    </div>`).join('');
  observeReveals();
}

// ---------- Cargar ARTESANOS ACTUALES ----------
let allArtisans = [];
async function loadArtisans() {
  allArtisans = await api.artisans();
  renderArtisans(allArtisans);
}
function renderArtisans(list) {
  const grid = $('#artisansGrid');
  if (!list.length) { grid.innerHTML = '<p>No se encontraron artesanos.</p>'; return; }
  grid.innerHTML = list.map((a) => `
    <article class="art-card reveal">
      <img src="${esc(a.photo || 'https://via.placeholder.com/300?text=Artesano')}" alt="${esc(a.name)}" loading="lazy" onerror="this.src='https://via.placeholder.com/300?text=Artesano'" />
      <div class="body">
        <span class="spec">${esc(a.specialty)}</span>
        <h3>${esc(a.name)}</h3>
        <p>${esc(a.description || '')}</p>
        ${socialLinks(a.instagram, a.facebook)}
      </div>
    </article>`).join('');
  observeReveals();
}

// Buscador
$('#artisanSearch')?.addEventListener('input', (e) => {
  const q = e.target.value.toLowerCase();
  renderArtisans(allArtisans.filter((a) =>
    (a.name || '').toLowerCase().includes(q) || (a.specialty || '').toLowerCase().includes(q)
  ));
});

// ---------- Cargar ARTESANOS ANTERIORES ----------
async function loadAlumni() {
  const data = await api.alumni();
  const grid = $('#alumniGrid');
  grid.innerHTML = data.map((a) => `
    <article class="art-card reveal">
      <img src="${esc(a.photo || 'https://via.placeholder.com/300?text=Alumno')}" alt="${esc(a.name)}" loading="lazy" onerror="this.src='https://via.placeholder.com/300?text=Alumno'" />
      <div class="body">
        <span class="spec">Clase ${a.year}</span>
        <h3>${esc(a.name)}</h3>
        <p>${esc(a.description || '')}</p>
        ${socialLinks(a.instagram, a.facebook)}
      </div>
    </article>`).join('');
  observeReveals();
}

// ---------- Cargar GALERÍA ----------
async function loadGallery() {
  const data = await api.gallery();
  const grid = $('#galleryGrid');
  grid.innerHTML = data.map((g) => `
    <figure class="reveal">
      <img src="${esc(g.image)}" alt="${esc(g.title || 'Galería')}" loading="lazy" onerror="this.src='https://via.placeholder.com/400?text=Imagen'" />
      <figcaption>${esc(g.title || '')}</figcaption>
    </figure>`).join('');
  observeReveals();
}

// ---------- Animaciones reveal ----------
let observer;
function observeReveals() {
  if (!observer) {
    observer = new IntersectionObserver((entries) => {
      entries.forEach((e) => { if (e.isIntersecting) e.target.classList.add('visible'); });
    }, { threshold: 0.1 });
  }
  document.querySelectorAll('.reveal:not(.visible)').forEach((el) => observer.observe(el));
}

function esc(str) {
  if (str == null) return '';
  return String(str).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function normalizeInstagram(val) {
  if (!val) return '';
  const v = val.trim();
  if (v.startsWith('http')) return v;
  if (v.startsWith('@')) return 'https://instagram.com/' + v.slice(1);
  return 'https://instagram.com/' + v;
}

function normalizeFacebook(val) {
  if (!val) return '';
  const v = val.trim();
  if (v.startsWith('http')) return v;
  if (v.startsWith('@')) return 'https://facebook.com/' + v.slice(1);
  if (!v.includes('facebook.com')) return 'https://facebook.com/' + v;
  return v;
}

function socialLinks(ig, fb) {
  const items = [];
  const igUrl = normalizeInstagram(ig);
  const fbUrl = normalizeFacebook(fb);
  if (igUrl) items.push(`<a class="social-link ig" href="${esc(igUrl)}" target="_blank" rel="noopener" aria-label="Instagram">Instagram</a>`);
  if (fbUrl) items.push(`<a class="social-link fb" href="${esc(fbUrl)}" target="_blank" rel="noopener" aria-label="Facebook">Facebook</a>`);
  return items.length ? `<div class="art-social">${items.join('')}</div>` : '';
}

// ---------- Init ----------
initTheme();

// Cada sección se carga de forma independiente. Si una falla (por ejemplo,
// la base de datos no está disponible), se muestra un mensaje en lugar de
// quedarse eternamente en "Cargando…".
const LOADERS = [
  [loadAnnouncements, '#announceGrid'],
  [loadProgramInfo, '#infoGrid'],
  [loadRequirements, '#reqCols'],
  [loadArtisans, '#artisansGrid'],
  [loadAlumni, '#alumniGrid'],
  [loadGallery, '#galleryGrid'],
];

LOADERS.forEach(([fn, sel]) => {
  fn().catch((err) => {
    console.error('Error cargando ' + sel + ':', err);
    const el = $(sel);
    if (el) el.innerHTML = '<p style="color:#b00020">⚠️ No se pudo cargar. Verifica la conexión con Supabase.</p>';
  });
});

// ---------- Lightbox de galería ----------
(function initLightbox() {
  const lightbox = $('#lightbox');
  const lightboxImg = $('#lightboxImg');
  const lightboxClose = $('#lightboxClose');

  function openLightbox(src, alt) {
    lightboxImg.src = src;
    lightboxImg.alt = alt || '';
    lightbox.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
  }

  function closeLightbox() {
    lightbox.classList.add('hidden');
    lightboxImg.src = '';
    document.body.style.overflow = '';
  }

  $('#galleryGrid').addEventListener('click', (e) => {
    const img = e.target.closest('img');
    if (!img) return;
    openLightbox(img.src, img.alt);
  });

  lightboxClose.addEventListener('click', (e) => {
    e.stopPropagation();
    closeLightbox();
  });

  lightbox.addEventListener('click', (e) => {
    if (e.target === lightbox) closeLightbox();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !lightbox.classList.contains('hidden')) {
      closeLightbox();
    }
  });
})();
