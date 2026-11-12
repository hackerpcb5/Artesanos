-- ============================================================
--  Usuarios y roles (Supabase Auth)
--  Sustituye a setup.js + la tabla "users" con bcrypt.
--
--  PASO 1 (Dashboard de Supabase > Authentication > Users > Add user):
--    Crea los usuarios con "Auto Confirm User" marcado:
--      admin@artesanos.local      (contraseña segura)
--      artesano@artesanos.local   (contraseña segura)
--    En la web se inicia sesión con "admin" / "artesano": el
--    frontend añade "@artesanos.local" (AUTH_EMAIL_DOMAIN en env.js).
--    También se puede escribir el email completo.
--
--  PASO 2 (Authentication > Providers > Email):
--    Desactiva "Allow new users to sign up" para que nadie pueda
--    registrarse por su cuenta. (Aunque lo hicieran, sin fila en
--    profiles no tendrían ningún permiso.)
--
--  PASO 3: ejecuta este script en el SQL Editor para asignar roles.
-- ============================================================

INSERT INTO public.profiles (id, username, role)
SELECT id, split_part(email, '@', 1), 'admin'
FROM auth.users WHERE email = 'admin@artesanos.local'
ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, username = EXCLUDED.username;

INSERT INTO public.profiles (id, username, role)
SELECT id, split_part(email, '@', 1), 'artisan'
FROM auth.users WHERE email = 'artesano@artesanos.local'
ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, username = EXCLUDED.username;

-- Comprobación
SELECT p.username, p.role, u.email FROM public.profiles p JOIN auth.users u ON u.id = p.id;
