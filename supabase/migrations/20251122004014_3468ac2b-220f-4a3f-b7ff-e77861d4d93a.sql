-- Remove excelhire_id column from jobs table
ALTER TABLE public.jobs DROP COLUMN IF EXISTS excelhire_id;