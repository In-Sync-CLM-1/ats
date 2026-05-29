-- Complete removal of CSBD (Customer Success Business Development) feature
-- This migration drops all CSBD-related tables, views, functions, and triggers

-- Drop view first (depends on tables)
DROP VIEW IF EXISTS public.csbd_actuals CASCADE;

-- Drop triggers
DROP TRIGGER IF EXISTS csbd_projection_audit_trigger ON public.csbd_projections;
DROP TRIGGER IF EXISTS update_csbd_projections_updated_at ON public.csbd_projections;
DROP TRIGGER IF EXISTS update_csbd_targets_updated_at ON public.csbd_targets;

-- Drop tables (CASCADE will drop dependent objects like foreign keys)
DROP TABLE IF EXISTS public.csbd_projection_audit CASCADE;
DROP TABLE IF EXISTS public.csbd_projections CASCADE;
DROP TABLE IF EXISTS public.csbd_targets CASCADE;

-- Drop function
DROP FUNCTION IF EXISTS public.log_csbd_projection_change() CASCADE;

-- Add comment for audit trail
COMMENT ON SCHEMA public IS 'Removed CSBD tables, views, and functions as part of feature removal on 2025-11-22';