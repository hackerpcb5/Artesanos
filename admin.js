// ============================================================
//  Panel de Administración - CRUD directo contra Supabase
//  Sustituye las llamadas fetch('/api/...') + token JWT propio.
//  Los permisos de escritura los impone RLS (solo rol 'admin').
// ============================================================
import { db, api, uploadFile, signIn, signOut, getCurrentUser } from './supabase/supabaseClient.js';

const $ = (s) => document.querySelector(s);
let currentTab = 'announcements';

// ---------- Toast ----------
function toast(msg, type = 'info') {
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = msg;
  $('#toast-container').appendChild(el);
  setTimeout(() => el.remove(), 3000);
}

// ---------- Auth ----------
$('#loginForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    const user = await signIn($('#username').value.trim(), $('#password').value);
    if (user?.role === 'admin') {
      showPanel();
    } else {
      await signOut();
      toast('Acceso denegado: se requiere rol de administrador', 'error');
    }
  } catch (err) {
    console.error('Error en login:', err);
    toast(err.message || 'No se pudo conectar con Supabase.', 'error');
  }
});

$('#logoutBtn')?.addEventListener('click', async () => {
  await signOut();
  $('#adminView').classList.add('hidden');
  $('#loginView').classList.remove('hidden');
});

function showPanel() {
  $('#loginView').classList.add('hidden');
  $('#adminView').classList.remove('hidden');
  selectTab('announcements');
}

// ---------- Tabs ----------
const TABS = {
  announcements: { title: 'Anuncios', render: renderAnnouncements },
  programInfo: { title: 'Información del Programa', render: renderProgramInfo },
  requirements: { title: 'Requisitos', render: renderRequirements },
  artisans: { title: 'Artesanos Actuales', render: renderArtisans },
  alumni: { title: 'Artesanos Anteriores', render: renderAlumni },
  gallery: { title: 'Galería', render: renderGallery },
  fair: { title: 'Próxima Feria', render: renderFair },
  notices: { title: 'Avisos de Artesanos', render: renderNotices },
  documents: { title: 'Documentos', render: renderDocuments },
  activities: { title: 'Actividades (Calendario)', render: renderActivities },
};

document.querySelectorAll('.tab').forEach((t) =>
  t.addEventListener('click', () => selectTab(t.dataset.tab))
);

function selectTab(name) {
  currentTab = name;
  document.querySelectorAll('.tab').forEach((t) => t.classList.toggle('active', t.dataset.tab === name));
  $('#tabTitle').textContent = TABS[name].title;
  // Solo algunas pestañas permiten "agregar"
  const addable = ['announcements', 'programInfo', 'requirements', 'artisans', 'alumni', 'gallery', 'notices', 'documents', 'activities'];
  $('#addBtn').style.display = addable.includes(name) ? 'inline-block' : 'none';
  $('#addBtn').onclick = () => openAdd(name);
  renderCurrent();
}

// Renderiza la pestaña activa mostrando el error si falla la consulta
async function renderCurrent() {
  try {
    await TABS[currentTab].render();
  } catch (err) {
    console.error('Error cargando ' + currentTab + ':', err);
    $('#panel').innerHTML = `<p style="color:#b00020">⚠️ No se pudo cargar: ${esc(err.message)}</p>`;
  }
}

// ---------- Helpers ----------
function openModal(html) { $('#modalBody').innerHTML = html; $('#modal').classList.remove('hidden'); }
$('#modalClose')?.addEventListener('click', () => $('#modal').classList.add('hidden'));
$('#modal').addEventListener('click', (e) => { if (e.target.id === 'modal') $('#modal').classList.add('hidden'); });
window.closeM = () => $('#modal').classList.add('hidden');

function esc(s) { return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
const val = (sel) => $(sel)?.value ?? '';
const orNull = (v) => (v === '' || v === undefined ? null : v);

// Ejecuta una operación de guardado: cierra modal, notifica y recarga
async function run(action, okMsg) {
  try {
    await action();
    closeM();
    toast(okMsg, 'success');
    renderCurrent();
  } catch (err) {
    console.error(err);
    toast(err.message || 'Error al guardar', 'error');
  }
}

// Redimensiona imágenes en el navegador antes de subirlas
function resizeImage(file, maxDim = 1200) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      let { width, height } = img;
      if (width > height && width > maxDim) {
        height = Math.round((height * maxDim) / width);
        width = maxDim;
      } else if (height > maxDim) {
        width = Math.round((width * maxDim) / height);
        height = maxDim;
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      canvas.getContext('2d').drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        (blob) => (blob ? resolve(new File([blob], file.name, { type: blob.type || file.type })) : reject(new Error('No se pudo procesar la imagen'))),
        file.type,
        0.85
      );
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Error cargando imagen')); };
    img.src = url;
  });
}

// Devuelve la URL final de la imagen:
//  - si hay archivo -> se redimensiona y se sube al bucket 'photos'
//  - si no -> se usa la URL escrita (o null si está vacía)
async function resolveImage(urlSel, fileSel) {
  const url = val(urlSel).trim();
  if (url && !url.startsWith('https://')) throw new Error('La URL de la imagen debe comenzar con https://');
  const file = $(fileSel)?.files[0];
  if (file) {
    let toUpload = file;
    try { toUpload = await resizeImage(file); } catch { /* se sube el original */ }
    return uploadFile(toUpload, 'photos');
  }
  return url || null;
}

// Eliminar (artesanos: soft delete, igual que el backend original)
window.del = async (table, id) => {
  if (!confirm('¿Eliminar este elemento?')) return;
  try {
    if (table === 'artisans') await db.update('artisans', id, { is_active: false });
    else await db.remove(table, id);
    toast('Eliminado', 'success');
    renderCurrent();
  } catch (err) {
    toast(err.message || 'Error al eliminar', 'error');
  }
};

// ---------- Formularios de alta ----------
window.openAdd = function (tab) {
  if (tab === 'announcements') openModal(`<h3>Nuevo Anuncio</h3>
    <label>Título</label><input id="f_title" />
    <label>Cuerpo</label><textarea id="f_body"></textarea>
    <label>Fecha publicación</label><input type="date" id="f_date" />
    <label><input type="checkbox" id="f_urgent" /> Urgente</label>
    <div class="modal-actions"><button class="btn btn-ghost" onclick="closeM()">Cancelar</button>
    <button class="btn btn-primary" onclick="addAnnouncement()">Crear</button></div>`);
  if (tab === 'programInfo') openModal(`<h3>Nueva Información del Programa</h3>
    <label>Sección</label><select id="f_section"><option value="history">Historia</option><option value="objectives">Objetivos</option><option value="benefits">Beneficios</option><option value="activities">Actividades</option></select>
    <label>Título</label><input id="f_title" />
    <label>Contenido</label><textarea id="f_content"></textarea>
    <div class="modal-actions"><button class="btn btn-ghost" onclick="closeM()">Cancelar</button>
    <button class="btn btn-primary" onclick="addProgramInfo()">Crear</button></div>`);
  if (tab === 'requirements') openModal(`<h3>Nuevo Requisito</h3>
    <label>Categoría</label><select id="f_cat"><option value="documents">Documentos</option><option value="criteria">Criterios</option><option value="dates">Fechas</option></select>
    <label>Título</label><input id="f_title" />
    <label>Descripción</label><textarea id="f_desc"></textarea>
    <label>Orden</label><input type="number" id="f_order" value="0" />
    <div class="modal-actions"><button class="btn btn-ghost" onclick="closeM()">Cancelar</button>
    <button class="btn btn-primary" onclick="addRequirement()">Crear</button></div>`);
  if (tab === 'artisans') openModal(`<h3>Nuevo Artesano</h3>
    <label>Nombre</label><input id="f_name" />
    <label>Especialidad</label><input id="f_spec" />
    <label>Descripción</label><textarea id="f_desc"></textarea>
    <label>Instagram (usuario o URL)</label><input id="f_ig" placeholder="@usuario o https://instagram.com/usuario" />
    <label>Facebook (URL o usuario)</label><input id="f_fb" placeholder="https://facebook.com/usuario" />
    <label>Foto (URL o subir)</label><input id="f_photo" placeholder="https://..." />
    <label>Subir imagen</label><input type="file" id="f_file" accept="image/*" />
    <div class="modal-actions"><button class="btn btn-ghost" onclick="closeM()">Cancelar</button>
    <button class="btn btn-primary" onclick="addArtisan()">Crear</button></div>`);
  if (tab === 'alumni') openModal(`<h3>Nuevo Artesano Anterior</h3>
    <label>Nombre</label><input id="f_name" />
    <label>Año</label><input type="number" id="f_year" required />
    <label>Descripción</label><textarea id="f_desc"></textarea>
    <label>Instagram (usuario o URL)</label><input id="f_ig" placeholder="@usuario o https://instagram.com/usuario" />
    <label>Facebook (URL o usuario)</label><input id="f_fb" placeholder="https://facebook.com/usuario" />
    <label>Foto (URL)</label><input id="f_photo" placeholder="https://..." />
    <label>Subir imagen</label><input type="file" id="f_file" accept="image/*" />
    <div class="modal-actions"><button class="btn btn-ghost" onclick="closeM()">Cancelar</button>
    <button class="btn btn-primary" onclick="addAlumni()">Crear</button></div>`);
  if (tab === 'gallery') openModal(`<h3>Nueva Foto</h3>
    <label>Título</label><input id="f_title" />
    <label>Imagen (URL)</label><input id="f_image_url" placeholder="https://..." />
    <label>Subir imagen</label><input type="file" id="f_file" accept="image/*" />
    <div class="modal-actions"><button class="btn btn-ghost" onclick="closeM()">Cancelar</button>
    <button class="btn btn-primary" onclick="addGallery()">Guardar</button></div>`);
  if (tab === 'notices') openModal(`<h3>Nuevo Aviso</h3>
    <label>Título</label><input id="f_title" />
    <label>Cuerpo</label><textarea id="f_body"></textarea>
    <label>Fecha</label><input type="date" id="f_date" />
    <label><input type="checkbox" id="f_urgent" /> Urgente</label>
    <div class="modal-actions"><button class="btn btn-ghost" onclick="closeM()">Cancelar</button>
    <button class="btn btn-primary" onclick="addNotice()">Crear</button></div>`);
  if (tab === 'documents') openModal(`<h3>Nuevo Documento</h3>
    <label>Título</label><input id="f_title" />
    <label>Archivo</label><input type="file" id="f_file" required />
    <div class="modal-actions"><button class="btn btn-ghost" onclick="closeM()">Cancelar</button>
    <button class="btn btn-primary" onclick="addDocument()">Subir</button></div>`);
  if (tab === 'activities') openModal(`<h3>Nueva Actividad</h3>
    <label>Título</label><input id="f_title" />
    <label>Fecha</label><input type="date" id="f_date" />
    <label>Descripción</label><textarea id="f_desc"></textarea>
    <div class="modal-actions"><button class="btn btn-ghost" onclick="closeM()">Cancelar</button>
    <button class="btn btn-primary" onclick="addActivity()">Crear</button></div>`);
};

// Fila de anuncio/aviso (si no hay fecha se usa el DEFAULT CURRENT_DATE)
function noticeRow() {
  const row = { title: val('#f_title'), body: val('#f_body'), is_urgent: $('#f_urgent').checked };
  if (val('#f_date')) row.published_at = val('#f_date');
  return row;
}

window.addAnnouncement = () => run(() => db.insert('announcements', noticeRow()), 'Anuncio creado');
window.addNotice = () => run(() => db.insert('artisan_notices', noticeRow()), 'Guardado');

window.addProgramInfo = () => run(() => db.insert('program_info', {
  section: val('#f_section'), title: val('#f_title'), content: val('#f_content'),
}), 'Guardado');

window.addRequirement = () => run(() => db.insert('requirements', {
  category: val('#f_cat'), title: val('#f_title'), description: val('#f_desc'), sort_order: Number(val('#f_order')) || 0,
}), 'Guardado');

window.addArtisan = () => run(async () => {
  const photo = await resolveImage('#f_photo', '#f_file');
  await db.insert('artisans', {
    name: val('#f_name'), specialty: val('#f_spec'), description: val('#f_desc'),
    photo: photo || '', instagram: val('#f_ig').trim(), facebook: val('#f_fb').trim(),
  });
}, 'Artesano creado');

window.addAlumni = () => run(async () => {
  const year = val('#f_year').trim();
  if (!year) throw new Error('El año es obligatorio');
  const photo = await resolveImage('#f_photo', '#f_file');
  await db.insert('alumni', {
    name: val('#f_name'), year: Number(year), description: val('#f_desc'),
    photo: photo || '', instagram: val('#f_ig').trim(), facebook: val('#f_fb').trim(),
  });
}, 'Artesano anterior creado');

window.addGallery = () => run(async () => {
  if (!val('#f_image_url').trim() && !$('#f_file').files[0]) throw new Error('Ingresa una URL o selecciona una imagen');
  const image = await resolveImage('#f_image_url', '#f_file');
  await db.insert('gallery', { title: val('#f_title'), image });
}, 'Foto guardada');

window.addDocument = () => run(async () => {
  const file = $('#f_file').files[0];
  if (!file) throw new Error('Archivo requerido');
  const url = await uploadFile(file, 'documents');
  await db.insert('documents', { title: val('#f_title'), filename: url });
}, 'Documento subido');

window.addActivity = () => run(async () => {
  if (!val('#f_date')) throw new Error('La fecha es obligatoria');
  await db.insert('activities', { title: val('#f_title'), activity_date: val('#f_date'), description: val('#f_desc') });
}, 'Guardado');

// ---------- Render: Anuncios ----------
async function renderAnnouncements() {
  const data = await api.announcements();
  $('#panel').innerHTML = data.map((a) => `
    <div class="list-item">
      <div>
        <h4>${esc(a.title)} ${a.is_urgent ? '⚠️' : ''}</h4>
        <p>${esc(a.body).slice(0, 80)}…</p>
        <span class="meta">📅 ${esc(a.published_at || '')}</span>
      </div>
      <div class="list-actions">
        <button class="btn btn-gold btn-sm" onclick="editAnnouncement(${a.id})">Editar</button>
        <button class="btn btn-danger btn-sm" onclick="del('announcements', ${a.id})">Eliminar</button>
      </div>
    </div>`).join('') || '<p>No hay anuncios.</p>';
}
window.editAnnouncement = async (id) => {
  const a = await db.get('announcements', id);
  if (!a) return toast('Registro no encontrado', 'error');
  openModal(`<h3>Editar Anuncio</h3>
    <label>Título</label><input id="f_title" value="${esc(a.title)}" />
    <label>Cuerpo</label><textarea id="f_body">${esc(a.body)}</textarea>
    <label>Fecha publicación</label><input type="date" id="f_date" value="${esc(a.published_at || '')}" />
    <label><input type="checkbox" id="f_urgent" ${a.is_urgent ? 'checked' : ''} /> Urgente</label>
    <div class="modal-actions">
      <button class="btn btn-ghost" onclick="closeM()">Cancelar</button>
      <button class="btn btn-primary" onclick="saveAnnouncement(${id})">Guardar</button>
    </div>`);
};
window.saveAnnouncement = (id) => run(() => db.update('announcements', id, {
  title: val('#f_title'), body: val('#f_body'), published_at: orNull(val('#f_date')), is_urgent: $('#f_urgent').checked,
}), 'Anuncio actualizado');

// ---------- Render: Info Programa ----------
async function renderProgramInfo() {
  const data = await api.programInfo();
  $('#panel').innerHTML = data.map((i) => `
    <div class="list-item">
      <div><h4>${esc(i.title)} <small>(${esc(i.section)})</small></h4><p>${esc(i.content).slice(0, 90)}…</p></div>
      <div class="list-actions">
        <button class="btn btn-gold btn-sm" onclick="editInfo(${i.id})">Editar</button>
        <button class="btn btn-danger btn-sm" onclick="del('program_info', ${i.id})">Eliminar</button>
      </div>
    </div>`).join('') || '<p>No hay información del programa.</p>';
}
window.editInfo = async (id) => {
  const i = await db.get('program_info', id);
  if (!i) return toast('Registro no encontrado', 'error');
  openModal(`<h3>Editar: ${esc(i.title)}</h3>
    <label>Título</label><input id="f_title" value="${esc(i.title)}" />
    <label>Contenido</label><textarea id="f_content">${esc(i.content)}</textarea>
    <div class="modal-actions"><button class="btn btn-ghost" onclick="closeM()">Cancelar</button>
    <button class="btn btn-primary" onclick="saveInfo(${id})">Guardar</button></div>`);
};
window.saveInfo = (id) => run(() => db.update('program_info', id, {
  title: val('#f_title'), content: val('#f_content'),
}), 'Actualizado');

// ---------- Render: Requisitos ----------
async function renderRequirements() {
  const data = await api.requirements();
  $('#panel').innerHTML = data.map((r) => `
    <div class="list-item">
      <div><h4>${esc(r.title)} <small>(${esc(r.category)})</small></h4><p>${esc(r.description || '')}</p></div>
      <div class="list-actions">
        <button class="btn btn-gold btn-sm" onclick="editReq(${r.id})">Editar</button>
        <button class="btn btn-danger btn-sm" onclick="del('requirements', ${r.id})">Eliminar</button>
      </div>
    </div>`).join('') || '<p>No hay requisitos.</p>';
}
window.editReq = async (id) => {
  const r = await db.get('requirements', id);
  if (!r) return toast('Registro no encontrado', 'error');
  openModal(`<h3>Editar Requisito</h3>
    <label>Categoría</label><select id="f_cat"><option ${r.category === 'documents' ? 'selected' : ''}>documents</option><option ${r.category === 'criteria' ? 'selected' : ''}>criteria</option><option ${r.category === 'dates' ? 'selected' : ''}>dates</option></select>
    <label>Título</label><input id="f_title" value="${esc(r.title)}" />
    <label>Descripción</label><textarea id="f_desc">${esc(r.description || '')}</textarea>
    <label>Orden</label><input type="number" id="f_order" value="${Number(r.sort_order) || 0}" />
    <div class="modal-actions"><button class="btn btn-ghost" onclick="closeM()">Cancelar</button>
    <button class="btn btn-primary" onclick="saveReq(${id})">Guardar</button></div>`);
};
window.saveReq = (id) => run(() => db.update('requirements', id, {
  category: val('#f_cat'), title: val('#f_title'), description: val('#f_desc'), sort_order: Number(val('#f_order')) || 0,
}), 'Actualizado');

// ---------- Render: Artesanos ----------
async function renderArtisans() {
  const data = await api.artisans();
  $('#panel').innerHTML = data.length ? `<div class="cards">` + data.map((a) => `
    <div class="card">
      <img src="${esc(a.photo || 'https://via.placeholder.com/300')}" alt="${esc(a.name)}" />
      <div class="body"><h4>${esc(a.name)}</h4><p>${esc(a.specialty)}</p>
        <div class="list-actions" style="margin-top:0.5rem;">
          <button class="btn btn-gold btn-sm" onclick="editArtisan(${a.id})">Editar</button>
          <button class="btn btn-danger btn-sm" onclick="del('artisans', ${a.id})">Eliminar</button>
        </div>
      </div>
    </div>`).join('') + `</div>` : '<p>No hay artesanos.</p>';
}
window.editArtisan = async (id) => {
  const a = await db.get('artisans', id);
  if (!a) return toast('Registro no encontrado', 'error');
  openModal(`<h3>Editar Artesano</h3>
    <label>Nombre</label><input id="f_name" value="${esc(a.name)}" />
    <label>Especialidad</label><input id="f_spec" value="${esc(a.specialty)}" />
    <label>Descripción</label><textarea id="f_desc">${esc(a.description || '')}</textarea>
    <label>Instagram</label><input id="f_ig" value="${esc(a.instagram || '')}" />
    <label>Facebook</label><input id="f_fb" value="${esc(a.facebook || '')}" />
    <label>Foto (URL)</label><input id="f_photo" value="${esc(a.photo)}" />
    <label>Cambiar imagen</label><input type="file" id="f_file" accept="image/*" />
    <div class="modal-actions"><button class="btn btn-ghost" onclick="closeM()">Cancelar</button>
    <button class="btn btn-primary" onclick="saveArtisan(${id})">Guardar</button></div>`);
};
window.saveArtisan = (id) => run(async () => {
  const patch = {
    name: val('#f_name'), specialty: val('#f_spec'), description: val('#f_desc'),
    instagram: val('#f_ig').trim(), facebook: val('#f_fb').trim(),
  };
  const photo = await resolveImage('#f_photo', '#f_file');
  if (photo !== null) patch.photo = photo; // sin URL ni archivo: se conserva la foto
  await db.update('artisans', id, patch);
}, 'Actualizado');

// ---------- Render: Alumni ----------
async function renderAlumni() {
  const data = await api.alumni();
  $('#panel').innerHTML = data.length ? `<div class="cards">` + data.map((a) => `
    <div class="card">
      <img src="${esc(a.photo || 'https://via.placeholder.com/300')}" alt="${esc(a.name)}" />
      <div class="body"><h4>${esc(a.name)}</h4><p>Año ${esc(a.year)}</p>
        <div class="list-actions" style="margin-top:0.5rem;">
          <button class="btn btn-gold btn-sm" onclick="editAlumni(${a.id})">Editar</button>
          <button class="btn btn-danger btn-sm" onclick="del('alumni', ${a.id})">Eliminar</button>
        </div>
      </div>
    </div>`).join('') + `</div>` : '<p>No hay registros.</p>';
}
window.editAlumni = async (id) => {
  const a = await db.get('alumni', id);
  if (!a) return toast('Registro no encontrado', 'error');
  openModal(`<h3>Editar Anterior</h3>
    <label>Nombre</label><input id="f_name" value="${esc(a.name)}" />
    <label>Año</label><input type="number" id="f_year" value="${esc(a.year)}" />
    <label>Descripción</label><textarea id="f_desc">${esc(a.description || '')}</textarea>
    <label>Instagram</label><input id="f_ig" value="${esc(a.instagram || '')}" />
    <label>Facebook</label><input id="f_fb" value="${esc(a.facebook || '')}" />
    <label>Foto (URL)</label><input id="f_photo" value="${esc(a.photo)}" />
    <label>Cambiar imagen</label><input type="file" id="f_file" accept="image/*" />
    <div class="modal-actions"><button class="btn btn-ghost" onclick="closeM()">Cancelar</button>
    <button class="btn btn-primary" onclick="saveAlumni(${id})">Guardar</button></div>`);
};
window.saveAlumni = (id) => run(async () => {
  const year = val('#f_year').trim();
  if (!year) throw new Error('El año es obligatorio');
  const patch = {
    name: val('#f_name'), year: Number(year), description: val('#f_desc'),
    instagram: val('#f_ig').trim(), facebook: val('#f_fb').trim(),
  };
  const photo = await resolveImage('#f_photo', '#f_file');
  if (photo !== null) patch.photo = photo;
  await db.update('alumni', id, patch);
}, 'Actualizado');

// ---------- Render: Galería ----------
async function renderGallery() {
  const data = await api.gallery();
  $('#panel').innerHTML = `<div class="cards">` + data.map((g) => `
    <div class="card"><img src="${esc(g.image)}" alt="${esc(g.title)}" />
      <div class="body"><h4>${esc(g.title || '')}</h4>
      <button class="btn btn-danger btn-sm" onclick="del('gallery', ${g.id})">Eliminar</button></div></div>`).join('') + `</div>`;
}

// ---------- Render: Feria (registro único) ----------
async function renderFair() {
  const f = await api.craftFair();
  $('#panel').innerHTML = `<div class="info-text">Información de la próxima feria de artesanías.</div>
    <div class="list-item"><div>
      <h4>${esc(f.title || 'Sin configurar')}</h4>
      <p>📅 ${esc(f.event_date || '')} 🕒 ${esc(f.event_time || '')}</p>
      <p>📍 ${esc(f.location || '')}</p>
    </div>
    <div class="list-actions"><button class="btn btn-gold btn-sm" onclick="editFair()">Editar</button></div></div>`;
}
window.editFair = async () => {
  const f = await api.craftFair(); // recarga para tener valores actuales
  openModal(`<h3>Editar Feria</h3>
    <label>Título</label><input id="f_title" value="${esc(f.title)}" />
    <label>Fecha</label><input type="date" id="f_date" value="${esc(f.event_date || '')}" />
    <label>Hora</label><input id="f_time" value="${esc(f.event_time)}" />
    <label>Lugar</label><input id="f_loc" value="${esc(f.location)}" />
    <label>Descripción</label><textarea id="f_desc">${esc(f.description)}</textarea>
    <label>Requisitos</label><textarea id="f_req">${esc(f.requirements)}</textarea>
    <div class="modal-actions"><button class="btn btn-ghost" onclick="closeM()">Cancelar</button>
    <button class="btn btn-primary" onclick="saveFair(${f.id ? Number(f.id) : 'null'})">Guardar</button></div>`);
};
window.saveFair = (id) => run(async () => {
  const row = {
    title: val('#f_title'), event_date: orNull(val('#f_date')), event_time: val('#f_time'),
    location: val('#f_loc'), description: val('#f_desc'), requirements: val('#f_req'),
  };
  // Si aún no existe la feria, se crea (antes fallaba sin registro)
  if (id) await db.update('craft_fair', id, row);
  else await db.insert('craft_fair', row);
}, 'Feria actualizada');

// ---------- Render: Avisos artesanos ----------
async function renderNotices() {
  const data = await api.artisanNotices();
  $('#panel').innerHTML = data.map((n) => `
    <div class="list-item"><div><h4>${esc(n.title)} ${n.is_urgent ? '⚠️' : ''}</h4><p>${esc(n.body).slice(0, 80)}…</p>
      <span class="meta">📅 ${esc(n.published_at || '')}</span></div>
      <div class="list-actions"><button class="btn btn-gold btn-sm" onclick="editNotice(${n.id})">Editar</button>
      <button class="btn btn-danger btn-sm" onclick="del('artisan_notices', ${n.id})">Eliminar</button></div></div>`).join('') || '<p>No hay avisos.</p>';
}
window.editNotice = async (id) => {
  const n = await db.get('artisan_notices', id);
  if (!n) return toast('Registro no encontrado', 'error');
  openModal(`<h3>Editar Aviso</h3>
    <label>Título</label><input id="f_title" value="${esc(n.title)}" />
    <label>Cuerpo</label><textarea id="f_body">${esc(n.body)}</textarea>
    <label>Fecha</label><input type="date" id="f_date" value="${esc(n.published_at || '')}" />
    <label><input type="checkbox" id="f_urgent" ${n.is_urgent ? 'checked' : ''} /> Urgente</label>
    <div class="modal-actions"><button class="btn btn-ghost" onclick="closeM()">Cancelar</button>
    <button class="btn btn-primary" onclick="saveNotice(${id})">Guardar</button></div>`);
};
window.saveNotice = (id) => run(() => db.update('artisan_notices', id, {
  title: val('#f_title'), body: val('#f_body'), published_at: orNull(val('#f_date')), is_urgent: $('#f_urgent').checked,
}), 'Aviso actualizado');

// ---------- Render: Documentos ----------
async function renderDocuments() {
  const data = await api.documents();
  $('#panel').innerHTML = data.map((d) => `
    <div class="list-item"><div><h4>${esc(d.title)}</h4><a href="${esc(d.filename)}" target="_blank" rel="noopener">📄 Ver/Descargar</a></div>
      <div class="list-actions"><button class="btn btn-danger btn-sm" onclick="del('documents', ${d.id})">Eliminar</button></div></div>`).join('') || '<p>No hay documentos.</p>';
}

// ---------- Render: Actividades ----------
async function renderActivities() {
  const data = await api.activities();
  $('#panel').innerHTML = data.map((a) => `
    <div class="list-item"><div><h4>${esc(a.title)}</h4><span class="meta">📅 ${esc(a.activity_date || '')}</span><p>${esc(a.description || '')}</p></div>
      <div class="list-actions"><button class="btn btn-gold btn-sm" onclick="editActivity(${a.id})">Editar</button>
      <button class="btn btn-danger btn-sm" onclick="del('activities', ${a.id})">Eliminar</button></div></div>`).join('') || '<p>No hay actividades.</p>';
}
window.editActivity = async (id) => {
  const a = await db.get('activities', id);
  if (!a) return toast('Registro no encontrado', 'error');
  openModal(`<h3>Editar Actividad</h3>
    <label>Título</label><input id="f_title" value="${esc(a.title)}" />
    <label>Fecha</label><input type="date" id="f_date" value="${esc(a.activity_date || '')}" />
    <label>Descripción</label><textarea id="f_desc">${esc(a.description || '')}</textarea>
    <div class="modal-actions"><button class="btn btn-ghost" onclick="closeM()">Cancelar</button>
    <button class="btn btn-primary" onclick="saveActivity(${id})">Guardar</button></div>`);
};
window.saveActivity = (id) => run(async () => {
  if (!val('#f_date')) throw new Error('La fecha es obligatoria');
  await db.update('activities', id, { title: val('#f_title'), activity_date: val('#f_date'), description: val('#f_desc') });
}, 'Actividad actualizada');

// ---------- Init: reemplaza GET /api/me ----------
(async () => {
  try {
    const user = await getCurrentUser();
    if (user?.role === 'admin') return showPanel();
  } catch (err) {
    console.error('Error verificando sesión:', err);
  }
  $('#loginView').classList.remove('hidden');
})();
