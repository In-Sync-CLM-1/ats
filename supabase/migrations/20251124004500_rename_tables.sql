-- Rename tables to match the final schema
-- These renames were originally done via Supabase dashboard, not migrations
ALTER TABLE public.projects RENAME TO mandates;
ALTER TABLE public.demandcom RENAME TO candidates;
