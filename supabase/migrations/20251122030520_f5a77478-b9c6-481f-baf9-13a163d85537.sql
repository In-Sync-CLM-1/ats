-- Assign platform_admin role to all existing users (you can modify this to target specific users)
-- This will help get you started with admin access

-- First, let's see what users we have and assign platform_admin to them
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'platform_admin'::app_role
FROM auth.users
WHERE NOT EXISTS (
  SELECT 1 FROM public.user_roles 
  WHERE user_roles.user_id = auth.users.id 
  AND user_roles.role = 'platform_admin'::app_role
)
ON CONFLICT (user_id, role) DO NOTHING;