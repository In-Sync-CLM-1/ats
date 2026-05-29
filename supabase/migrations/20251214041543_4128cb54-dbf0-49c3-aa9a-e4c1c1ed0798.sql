-- Add coordinator_id column to sites table
ALTER TABLE public.sites 
ADD COLUMN coordinator_id uuid REFERENCES public.profiles(id);

-- Update can_access_site function to check coordinator_id on sites table
CREATE OR REPLACE FUNCTION public.can_access_site(_user_id uuid, _site_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM sites WHERE id = _site_id AND coordinator_id = _user_id
  )
  OR has_role(_user_id, 'admin'::app_role)
  OR has_role(_user_id, 'super_admin'::app_role)
  OR has_role(_user_id, 'platform_admin'::app_role)
  OR has_role(_user_id, 'admin_tech'::app_role)
  OR has_role(_user_id, 'admin_administration'::app_role)
$function$;