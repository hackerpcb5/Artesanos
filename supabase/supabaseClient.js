// ============================================================
//  Cliente de Supabase para el NAVEGADOR (frontend-only)
//  Sustituye a server.js + supabase/db.js + supabase/auth.js.
//
//  Todo acceso a datos pasa por @supabase/supabase-js con la
//  clave pública (anon). Los permisos los aplica Postgres con
//  Row Level Security (ver supabase/policies.sql):
//    - Lectura pública: anuncios, info, requisitos, artesanos,
//      alumni, galería.
//    - Lectura para artesanos/admin: feria, avisos, documentos,
//      actividades.
//    - Escritura (insert/update/delete + Storage): solo admin.
// ============================================================
import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_ANON_KEY, AUTH_EMAIL_DOMAIN } from '../env.js';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,      // la sesión se guarda en localStorage
    autoRefreshToken: true,    // renueva el JWT automáticamente
    storageKey: 'artesanos-auth',
  },
});

// ------------------------------------------------------------
//  Utilidades internas
// ------------------------------------------------------------
function unwrap({ data, error }) {
  if (error) throw new Error(error.message);
  return data;
}

// Mensaje claro cuando RLS filtra la fila (no lanza error, devuelve 0 filas)
function ensureRows(rows, action) {
  if (!rows || rows.length === 0) {
    throw new Error(`No se pudo ${action}: no tienes permisos o el registro no existe.`);
  }
  return rows[0];
}

// ------------------------------------------------------------
//  CRUD genérico (reemplaza las rutas /api/* de Express)
// ------------------------------------------------------------
export const db = {
  // SELECT * FROM table [filtros] ORDER BY ...
  async list(table, orders = [], build) {
    let q = supabase.from(table).select('*');
    if (build) q = build(q);
    for (const [col, ascending = true] of orders) q = q.order(col, { ascending });
    return unwrap(await q);
  },

  // SELECT * FROM table WHERE id = $1
  async get(table, id) {
    return unwrap(await supabase.from(table).select('*').eq('id', id).maybeSingle());
  },

  // INSERT ... RETURNING *
  async insert(table, row) {
    return ensureRows(unwrap(await supabase.from(table).insert(row).select()), 'crear el registro');
  },

  // UPDATE ... WHERE id = $n RETURNING *
  async update(table, id, patch) {
    return ensureRows(unwrap(await supabase.from(table).update(patch).eq('id', id).select()), 'actualizar el registro');
  },

  // DELETE ... WHERE id = $1
  async remove(table, id) {
    return ensureRows(unwrap(await supabase.from(table).delete().eq('id', id).select()), 'eliminar el registro');
  },
};

// ------------------------------------------------------------
//  Consultas de lectura (mismo orden que tenía server.js)
// ------------------------------------------------------------
export const api = {
  announcements: () => db.list('announcements', [['is_urgent', false], ['published_at', false]]),
  programInfo: () => db.list('program_info', [['id']]),
  requirements: () => db.list('requirements', [['category'], ['sort_order']]),
  artisans: () => db.list('artisans', [['name']], (q) => q.eq('is_active', true)),
  alumni: () => db.list('alumni', [['year', false]]),
  gallery: () => db.list('gallery', [['id', false]]),
  craftFair: async () => (await db.list('craft_fair', [['id', false]], (q) => q.limit(1)))[0] || {},
  artisanNotices: () => db.list('artisan_notices', [['is_urgent', false], ['published_at', false]]),
  documents: () => db.list('documents', [['id', false]]),
  activities: () => db.list('activities', [['activity_date']]),
};

// ------------------------------------------------------------
//  Storage (reemplaza multer + uploadToSupabaseStorage)
// ------------------------------------------------------------
const MAX_SIZE = { photos: 5 * 1024 * 1024, documents: 10 * 1024 * 1024 };

export async function uploadFile(file, bucket = 'photos') {
  if (!file) throw new Error('Archivo requerido');
  const limit = MAX_SIZE[bucket];
  if (limit && file.size > limit) {
    throw new Error(`El archivo supera el límite de ${Math.round(limit / 1024 / 1024)} MB`);
  }
  const dot = (file.name || '').lastIndexOf('.');
  const ext = dot >= 0 ? file.name.slice(dot).toLowerCase() : '';
  const fileName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;

  const { error } = await supabase.storage.from(bucket).upload(fileName, file, {
    contentType: file.type || undefined,
    upsert: false,
  });
  if (error) throw new Error('No se pudo subir el archivo: ' + error.message);

  return supabase.storage.from(bucket).getPublicUrl(fileName).data.publicUrl;
}

// ------------------------------------------------------------
//  Autenticación (reemplaza /api/login, /api/me, JWT y bcrypt)
// ------------------------------------------------------------
export function usernameToEmail(username) {
  const u = String(username || '').trim().toLowerCase();
  return u.includes('@') ? u : `${u}@${AUTH_EMAIL_DOMAIN}`;
}

async function loadProfile(user) {
  if (!user) return null;
  const { data, error } = await supabase
    .from('profiles')
    .select('username, role')
    .eq('id', user.id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return {
    id: user.id,
    email: user.email,
    username: data?.username || user.email?.split('@')[0],
    role: data?.role || null, // sin perfil => sin permisos
  };
}

// Inicia sesión y devuelve { id, email, username, role }
export async function signIn(username, password) {
  if (!username || !password) throw new Error('Faltan credenciales');
  const { data, error } = await supabase.auth.signInWithPassword({
    email: usernameToEmail(username),
    password,
  });
  if (error) {
    throw new Error(/invalid login credentials/i.test(error.message)
      ? 'Usuario o contraseña incorrectos'
      : error.message);
  }
  return loadProfile(data.user);
}

export async function signOut() {
  await supabase.auth.signOut();
}

// Equivalente a GET /api/me: valida la sesión contra Supabase
export async function getCurrentUser() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return null;
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  return loadProfile(data.user);
}
