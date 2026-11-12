// ============================================================
//  Build estático (sin dependencias): copia el sitio a dist/ y
//  genera dist/env.js desde variables de entorno.
//  Lo ejecutan Vercel, Netlify y GitHub Actions. No es un servidor.
//
//  Variables aceptadas (la primera que exista):
//    SUPABASE_URL       | VITE_SUPABASE_URL      | NEXT_PUBLIC_SUPABASE_URL
//    SUPABASE_ANON_KEY  | SUPABASE_PUBLISHABLE_KEY | VITE_SUPABASE_ANON_KEY
//    AUTH_EMAIL_DOMAIN  (opcional, por defecto artesanos.local)
// ============================================================
import { cpSync, mkdirSync, readdirSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { extname, join } from 'node:path';

const env = (...names) => names.map((n) => process.env[n]).find((v) => v && v.trim());

const url = env('SUPABASE_URL', 'VITE_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_URL');
const key = env('SUPABASE_ANON_KEY', 'SUPABASE_PUBLISHABLE_KEY', 'VITE_SUPABASE_ANON_KEY', 'NEXT_PUBLIC_SUPABASE_ANON_KEY');
const domain = env('AUTH_EMAIL_DOMAIN') || 'artesanos.local';

// Protección: jamás publicar una clave privada en el frontend
function isSecretKey(k) {
  if (!k) return false;
  if (k.startsWith('sb_secret_')) return true;
  try {
    const payload = JSON.parse(Buffer.from(k.split('.')[1], 'base64url').toString());
    return payload.role === 'service_role';
  } catch {
    return false;
  }
}
if (isSecretKey(key)) {
  console.error('❌ SUPABASE_ANON_KEY contiene una clave service_role/secret. Usa la clave anon/publishable.');
  process.exit(1);
}

// 1. Copiar archivos estáticos a dist/
const OUT = 'dist';
const STATIC_EXT = new Set(['.html', '.css', '.js', '.png', '.jpg', '.jpeg', '.svg', '.webp', '.ico', '.gif']);
rmSync(OUT, { recursive: true, force: true });
mkdirSync(join(OUT, 'supabase'), { recursive: true });

for (const f of readdirSync('.', { withFileTypes: true })) {
  if (f.isFile() && STATIC_EXT.has(extname(f.name).toLowerCase())) cpSync(f.name, join(OUT, f.name));
}
if (existsSync('uploads')) cpSync('uploads', join(OUT, 'uploads'), { recursive: true });
cpSync('supabase/supabaseClient.js', join(OUT, 'supabase', 'supabaseClient.js'));

// 2. Generar env.js (si no hay variables se conserva el env.js del repo)
if (url && key) {
  const js = `// Generado por scripts/build-env.mjs — valores públicos\n` +
    `export const SUPABASE_URL = ${JSON.stringify(url.trim())};\n` +
    `export const SUPABASE_ANON_KEY = ${JSON.stringify(key.trim())};\n` +
    `export const AUTH_EMAIL_DOMAIN = ${JSON.stringify(domain.trim())};\n`;
  writeFileSync(join(OUT, 'env.js'), js);
  console.log(`✅ dist/env.js generado para ${url}`);
} else {
  console.log('ℹ️  Sin SUPABASE_URL / SUPABASE_ANON_KEY: se usa el env.js del repositorio.');
}
console.log('✅ Sitio estático listo en dist/');
