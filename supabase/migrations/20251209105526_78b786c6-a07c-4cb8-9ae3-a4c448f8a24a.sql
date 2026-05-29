-- Insert all standard roles into role_metadata (skip zonal_coordinator as it already exists)
INSERT INTO public.role_metadata (role, display_name, description, hierarchy_level, is_visible_in_ui, can_be_assigned_by)
VALUES
  ('platform_admin', 'Platform Admin', 'Highest system access - full control over all features', 100, true, ARRAY['platform_admin']::app_role[]),
  ('super_admin', 'Super Admin', 'Full system access across all modules', 90, true, ARRAY['platform_admin', 'super_admin']::app_role[]),
  ('admin_administration', 'Admin (Administration)', 'Manages users, teams, and HR functions', 80, true, ARRAY['platform_admin', 'super_admin']::app_role[]),
  ('admin_tech', 'Admin (Tech)', 'Manages system configuration and integrations', 80, true, ARRAY['platform_admin', 'super_admin']::app_role[]),
  ('admin', 'Admin', 'General administrative access', 70, true, ARRAY['platform_admin', 'super_admin', 'admin_tech']::app_role[]),
  ('manager', 'Manager', 'Team lead, manages clients and jobs', 60, true, ARRAY['platform_admin', 'super_admin', 'admin_administration', 'admin_tech']::app_role[]),
  ('agent', 'Agent', 'Regular user, handles participants', 40, true, ARRAY['platform_admin', 'super_admin', 'admin_administration', 'admin_tech', 'manager']::app_role[]),
  ('user', 'User', 'Basic access (legacy)', 10, true, ARRAY['platform_admin', 'super_admin', 'admin_administration', 'admin_tech']::app_role[])
ON CONFLICT (role) DO NOTHING;