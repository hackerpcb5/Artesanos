# 🧶 Organización de Artesanos y Empresarios Juveniles PCB

Aplicación web **estática** (HTML/CSS/JS) para la Organización de Artesanos y Empresarios
Juveniles PCB. Incluye sitio público, panel de administración con CRUD completo y un portal
exclusivo para artesanos. **No necesita servidor propio**: el navegador se conecta
directamente a Supabase con `@supabase/supabase-js`, y la seguridad la aplica Postgres
mediante **Row Level Security (RLS)**.

## 🏗️ Arquitectura

```
Navegador (index / admin / portal)
   │  import { createClient } from '@supabase/supabase-js'   (import map → jsDelivr)
   ▼
Supabase
   ├─ Auth      → login (email/contraseña) y sesión JWT
   ├─ PostgREST → tablas con RLS (lectura pública / miembros, escritura solo admin)
   └─ Storage   → buckets públicos `photos` y `documents` (subida solo admin)
```

| Antes (Express)                         | Ahora                                         |
|-----------------------------------------|-----------------------------------------------|
| `server.js` + rutas `/api/*`            | `supabase/supabaseClient.js` (`db`, `api`)     |
| `pg` Pool (`supabase/db.js`)            | supabase-js (PostgREST)                        |
| JWT + bcrypt (`supabase/auth.js`)       | Supabase Auth + tabla `profiles` (rol)         |
| Middlewares `requireAdmin/Artisan`      | Políticas RLS (`supabase/policies.sql`)        |
| `multer` + service key                  | `supabase.storage.upload()` + políticas Storage|
| `setup.js` / `npm run db:*`             | SQL Editor de Supabase                         |
| `.env` en el servidor                   | `env.js` (público) generado en el build        |

## 📁 Estructura

```
├── index.html / admin.html / portal.html
├── styles.css / admin.css / portal.css
├── main.js / admin.js / portal.js     # Lógica (ES modules)
├── env.js                             # URL + anon key (públicas)
├── supabase/
│   ├── supabaseClient.js              # ⭐ Cliente Supabase del navegador
│   ├── schema.sql                     # Tablas (+ profiles)
│   ├── policies.sql                   # RLS, roles y Storage
│   ├── seed.sql                       # Datos de ejemplo
│   └── users.sql                      # Asignar roles a usuarios
├── uploads/                           # PDFs de ejemplo (estáticos)
├── scripts/build-env.mjs              # Build sin dependencias → dist/
├── vercel.json / netlify.toml
└── .github/workflows/deploy-pages.yml
```

## 🚀 Puesta en marcha

### 1. Supabase (una sola vez)
En **SQL Editor**, ejecuta en orden:
1. `supabase/schema.sql`
2. `supabase/policies.sql`
3. `supabase/seed.sql` (opcional)

Luego, en **Authentication → Users → Add user** crea (con *Auto Confirm*):
- `admin@artesanos.local`
- `artesano@artesanos.local`

Ejecuta `supabase/users.sql` para asignarles los roles `admin` y `artisan`.
En **Authentication → Providers → Email** desactiva *Allow new users to sign up*.

En la web se entra con el usuario corto (`admin`, `artesano`) o con el email completo.

### 2. Configuración
Edita `env.js` con la URL y la clave **anon/publishable** de tu proyecto
(Project Settings → API). Nunca uses la `service_role` / `sb_secret_`.

### 3. Probar en local
Los ES modules no funcionan con `file://`; usa cualquier servidor estático, por ejemplo:
- VS Code → extensión *Live Server*
- `python -m http.server 8080`

### 4. Desplegar
| Plataforma    | Pasos |
|---------------|-------|
| **Vercel**    | Importa el repo. `vercel.json` ya define build y `dist/`. Variables: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `AUTH_EMAIL_DOMAIN`. |
| **Netlify**   | Importa el repo. `netlify.toml` ya define build y `dist/`. Mismas variables en *Site settings → Environment variables*. |
| **GitHub Pages** | Settings → Pages → Source: *GitHub Actions*. Crea las mismas como *Actions Variables*. El workflow `deploy-pages.yml` despliega al hacer push a `main`. |

Si no defines variables, se usa el `env.js` del repositorio.

## 🔐 Permisos (RLS)

| Tabla | Lectura | Escritura |
|-------|---------|-----------|
| announcements, program_info, requirements, alumni, gallery | Pública | Admin |
| artisans | Pública (solo `is_active`), admin ve todos | Admin |
| craft_fair, artisan_notices, documents, activities | Artesano o admin | Admin |
| profiles | Cada usuario su perfil; admin todos | Nadie desde el cliente |
| Storage `photos` / `documents` | Pública (URL) | Admin |

## 📝 Notas
- Toda la entrada de usuario se escapa para evitar XSS en el render.
- Las imágenes se redimensionan en el navegador (máx. 1200 px) antes de subirse.
- Los archivos de `documents` son públicos por URL (como antes). Si deben ser privados,
  ver la sección de seguridad en la documentación de migración.

© Organización de Artesanos y Empresarios Juveniles PCB · Puerto Rico 🇵🇷
