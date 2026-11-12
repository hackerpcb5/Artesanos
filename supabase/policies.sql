-- ============================================================
--  Seguridad: Row Level Security + Storage
--  Sustituye a los middlewares authenticate / requireAdmin /
--  requireArtisan de Express. Ejecutar DESPUÉS de schema.sql.
--  Es idempotente: se puede volver a ejecutar sin problema.
-- ============================================================

-- ------------------------------------------------------------
--  1. Funciones de rol (leen public.profiles del usuario actual)
--     SECURITY DEFINER para que funcionen aunque profiles tenga RLS.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.current_app_role() RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION public.is_admin() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(public.current_app_role() = 'admin', false)
$$;

CREATE OR REPLACE FUNCTION public.is_member() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(public.current_app_role() IN ('admin', 'artisan'), false)
$$;

-- ------------------------------------------------------------
--  2. profiles: cada usuario ve su propio perfil; admin ve todos.
--     Nadie puede modificar roles desde el cliente (sin políticas
--     de INSERT/UPDATE/DELETE). Los roles se asignan en el SQL Editor.
-- ------------------------------------------------------------
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS profiles_select ON public.profiles;
CREATE POLICY profiles_select ON public.profiles
  FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.is_admin());

-- ------------------------------------------------------------
--  3. Tablas de contenido
--     Lectura:   pública   -> sitio público (index.html)
--                miembros  -> portal de artesanos (portal.html)
--     Escritura: solo admin (admin.html)
-- ------------------------------------------------------------
DO $$
DECLARE
  t text;
  public_tables  text[] := ARRAY['announcements','program_info','requirements','alumni','gallery'];
  member_tables  text[] := ARRAY['craft_fair','artisan_notices','documents','activities'];
  all_tables     text[] := public_tables || member_tables || ARRAY['artisans'];
BEGIN
  FOREACH t IN ARRAY all_tables LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);

    -- Limpia políticas previas de este script
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_read',   t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_insert', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_update', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_delete', t);

    -- Escritura solo admin
    EXECUTE format('CREATE POLICY %I ON public.%I FOR INSERT TO authenticated WITH CHECK (public.is_admin())', t || '_insert', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin())', t || '_update', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR DELETE TO authenticated USING (public.is_admin())', t || '_delete', t);

    EXECUTE format('GRANT SELECT ON public.%I TO anon, authenticated', t);
    EXECUTE format('GRANT INSERT, UPDATE, DELETE ON public.%I TO authenticated', t);
  END LOOP;

  FOREACH t IN ARRAY public_tables LOOP
    EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT TO anon, authenticated USING (true)', t || '_read', t);
  END LOOP;

  FOREACH t IN ARRAY member_tables LOOP
    EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (public.is_member())', t || '_read', t);
  END LOOP;
END $$;

-- artisans: el público solo ve activos; el admin ve todos (soft delete)
CREATE POLICY artisans_read ON public.artisans
  FOR SELECT TO anon, authenticated
  USING (is_active OR public.is_admin());

GRANT SELECT ON public.profiles TO authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- ------------------------------------------------------------
--  4. Tabla legada "users" (bcrypt del antiguo backend)
--     Se bloquea por completo: con la anon key era legible por
--     cualquiera si no tenía RLS. Bórrala cuando ya no la necesites:
--       DROP TABLE public.users;
-- ------------------------------------------------------------
DO $$
BEGIN
  IF to_regclass('public.users') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.users ENABLE ROW LEVEL SECURITY';
    EXECUTE 'REVOKE ALL ON public.users FROM anon, authenticated';
  END IF;
END $$;

-- ------------------------------------------------------------
--  5. Storage: buckets públicos de lectura, escritura solo admin
--     (antes se subía con la service key desde server.js)
-- ------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('photos',    'photos',    true, 5242880,  ARRAY['image/*']),
  ('documents', 'documents', true, 10485760, NULL)
ON CONFLICT (id) DO UPDATE
  SET public = EXCLUDED.public,
      file_size_limit = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS artesanos_storage_select ON storage.objects;
DROP POLICY IF EXISTS artesanos_storage_insert ON storage.objects;
DROP POLICY IF EXISTS artesanos_storage_update ON storage.objects;
DROP POLICY IF EXISTS artesanos_storage_delete ON storage.objects;

CREATE POLICY artesanos_storage_select ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id IN ('photos', 'documents') AND public.is_admin());

CREATE POLICY artesanos_storage_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id IN ('photos', 'documents') AND public.is_admin());

CREATE POLICY artesanos_storage_update ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id IN ('photos', 'documents') AND public.is_admin());

CREATE POLICY artesanos_storage_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id IN ('photos', 'documents') AND public.is_admin());
