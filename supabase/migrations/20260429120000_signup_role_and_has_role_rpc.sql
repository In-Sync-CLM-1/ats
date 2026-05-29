-- ============================================================
-- Self-signup role hygiene + has_role RPC for compatibility
-- ============================================================
-- Two changes:
--
-- 1. Stop the handle_new_user trigger from auto-inserting an
--    'agent' role row. The role decision moves to the application
--    layer (manage-org create -> 'admin', admin-create-user -> chosen,
--    bootstrap-platform-admin -> 'platform_admin'), so we never write
--    a role we'll need to overwrite.
--
-- 2. Add a has_role() SQL function. OrgContext.tsx already calls
--    supabase.rpc('has_role', { _user_id, _role: 'platform_admin' });
--    ats has only is_platform_admin() so far. has_role mirrors wa's
--    semantics: a platform_admin satisfies any role check (so admin
--    UI gates work for them) and otherwise checks for an exact role
--    match in user_roles.
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'full_name')
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND (role = _role OR role = 'platform_admin')
  );
$$;

GRANT EXECUTE ON FUNCTION public.has_role(UUID, public.app_role) TO authenticated, anon;
