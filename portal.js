// ============================================================
//  Portal de Artesanos - Lógica (protegido por Supabase Auth)
//  RLS: solo usuarios con rol 'artisan' o 'admin' pueden leer
//  craft_fair, artisan_notices, documents y activities.
// ============================================================
import { api, signIn, signOut, getCurrentUser } from './supabase/supabaseClient.js';

const $ = (s) => document.querySelector(s);
const PORTAL_ROLES = ['artisan', 'admin'];

function toast(msg, type = 'info') {
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = msg;
  $('#toast-container').appendChild(el);
  setTimeout(() => el.remove(), 3000);
}
function esc(s) { return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

// ---------- Login ----------
$('#loginForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    const user = await signIn($('#username').value.trim(), $('#password').value);
    if (PORTAL_ROLES.includes(user?.role)) {
      showPortal();
    } else {
      await signOut();
      toast('Acceso denegado: tu usuario no tiene acceso al portal', 'error');
    }
  } catch (err) {
    console.error('Error en login:', err);
    toast(err.message || 'No se pudo conectar con Supabase.', 'error');
  }
});

$('#logoutBtn')?.addEventListener('click', async () => {
  await signOut();
  $('#portalView').classList.add('hidden');
  $('#loginView').classList.remove('hidden');
});

// ---------- Modo oscuro ----------
if (localStorage.getItem('ptheme') === 'dark') {
  document.documentElement.setAttribute('data-theme', 'dark');
  const tg = document.querySelector('#themeToggle');
  if (tg) tg.textContent = '☀️';
}

$('#themeToggle')?.addEventListener('click', () => {
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  if (isDark) { document.documentElement.removeAttribute('data-theme'); localStorage.setItem('ptheme', 'light'); $('#themeToggle').textContent = '🌙'; }
  else { document.documentElement.setAttribute('data-theme', 'dark'); localStorage.setItem('ptheme', 'dark'); $('#themeToggle').textContent = '☀️'; }
});

function showPortal() {
  if (localStorage.getItem('ptheme') === 'dark') { document.documentElement.setAttribute('data-theme', 'dark'); $('#themeToggle').textContent = '☀️'; }
  $('#loginView').classList.add('hidden');
  $('#portalView').classList.remove('hidden');
  loadFair(); loadNotices(); loadDocuments(); loadCalendar();
}

// ---------- Cargar Feria ----------
async function loadFair() {
  try {
    const f = await api.craftFair();
    $('#fairContent').innerHTML = `
      <h3 class="fair-title">${esc(f.title || 'Por confirmar')}</h3>
      <p><strong>📅 Fecha:</strong> ${esc(f.event_date || '—')}</p>
      <p><strong>🕒 Hora:</strong> ${esc(f.event_time || '—')}</p>
      <p><strong>📍 Lugar:</strong> ${esc(f.location || '—')}</p>
      <p style="margin-top:0.6rem;">${esc(f.description || '')}</p>
       <p style="margin-top:0.6rem;"><strong>Requisitos para participar:</strong> ${esc(f.requirements || '—')}</p>`;
  } catch (err) {
    console.error('Error cargando feria:', err);
    $('#fairContent').innerHTML = '<p class="error">No se pudo cargar la información de la feria.</p>';
  }
}

// ---------- Cargar Avisos ----------
async function loadNotices() {
  try {
    const data = await api.artisanNotices();
    $('#notices').innerHTML = data.map((n) => `
      <div class="notice ${n.is_urgent ? 'urgent' : ''}">
        <strong>${esc(n.title)} ${n.is_urgent ? '⚠️' : ''}</strong>
        <p>${esc(n.body)}</p>
        <span class="date">📅 ${esc(n.published_at || '')}</span>
      </div>`).join('') || '<p>No hay avisos.</p>';
  } catch (err) {
    console.error('Error cargando avisos:', err);
    $('#notices').innerHTML = '<p class="error">No se pudieron cargar los avisos.</p>';
  }
}

// ---------- Cargar Documentos ----------
// Los documentos subidos guardan la URL pública de Storage; los de
// ejemplo antiguos guardaban solo el nombre (se sirven desde /uploads).
function docUrl(filename) {
  const f = String(filename || '');
  if (!f || /^https?:\/\//i.test(f) || f.startsWith('/') || f.startsWith('uploads/')) return f;
  return 'uploads/' + f;
}

async function loadDocuments() {
  try {
    const data = await api.documents();
    $('#documents').innerHTML = data.map((d) => `<li><button class="doc-item-btn" data-url="${esc(docUrl(d.filename))}" data-title="${esc(d.title)}">📄 ${esc(d.title)}</button></li>`).join('') || '<li>No hay documentos.</li>';
    document.querySelectorAll('.doc-item-btn').forEach((btn) => {
      btn.addEventListener('click', () => openDocViewer(btn.dataset.url, btn.dataset.title));
    });
  } catch (err) {
    console.error('Error cargando documentos:', err);
    $('#documents').innerHTML = '<li class="error">No se pudieron cargar los documentos.</li>';
  }
}

// ---------- Visor de documentos ----------
function openDocViewer(url, title) {
  const viewer = $('#docViewer');
  const body = $('#docViewerBody');
  const lower = (url || '').toLowerCase();
  body.innerHTML = '';
  if (/\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(lower)) {
    body.innerHTML = `<img src="${esc(url)}" alt="${esc(title)}" />`;
  } else if (/\.pdf$/i.test(lower)) {
    body.innerHTML = `<iframe src="${esc(url)}" title="${esc(title)}"></iframe>`;
  } else {
    body.innerHTML = `<a class="btn btn-primary" href="${esc(url)}" target="_blank" rel="noopener">Descargar / Abrir ${esc(title)}</a>`;
  }
  viewer.classList.remove('hidden');
}
$('#docViewerClose')?.addEventListener('click', () => $('#docViewer').classList.add('hidden'));
$('#docViewer')?.addEventListener('click', (e) => { if (e.target === $('#docViewer')) $('#docViewer').classList.add('hidden'); });

// ---------- Cargar Calendario ----------
async function loadCalendar() {
  try {
    const data = await api.activities();
    $('#calendar').innerHTML = data.map((a) => `
      <div class="cal-item">
        <div class="date">📅 ${esc(a.activity_date || '')}</div>
        <strong>${esc(a.title)}</strong>
        <p class="cal-desc">${esc(a.description || '')}</p>
      </div>`).join('') || '<p>Sin actividades programadas.</p>';
  } catch (err) {
    console.error('Error cargando calendario:', err);
    $('#calendar').innerHTML = '<p class="error">No se pudo cargar el calendario.</p>';
  }
}

// ---------- Init: reemplaza GET /api/me ----------
(async () => {
  try {
    const user = await getCurrentUser();
    if (PORTAL_ROLES.includes(user?.role)) return showPortal();
  } catch (err) {
    console.error('Error verificando sesión:', err);
  }
  $('#loginView').classList.remove('hidden');
})();
