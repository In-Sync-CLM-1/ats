-- Add zonal_coordinator to role_metadata
INSERT INTO public.role_metadata (role, display_name, description, hierarchy_level, is_visible_in_ui, can_be_assigned_by)
VALUES (
  'zonal_coordinator',
  'Zonal Coordinator',
  'Manages headcount for assigned sites',
  50,
  true,
  ARRAY['platform_admin', 'super_admin', 'admin_administration', 'admin_tech', 'admin']::app_role[]
);