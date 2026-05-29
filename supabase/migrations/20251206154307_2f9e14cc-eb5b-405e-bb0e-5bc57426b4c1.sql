-- Phase 1: Drop triggers that call AI matching
DROP TRIGGER IF EXISTS mandate_created_auto_match ON mandates;
DROP TRIGGER IF EXISTS master_updated_rematch ON master;
DROP TRIGGER IF EXISTS update_master_updated_at ON master;

-- Phase 2: Drop database functions
DROP FUNCTION IF EXISTS trigger_auto_match_on_mandate_create();
DROP FUNCTION IF EXISTS trigger_rematch_on_master_update();
DROP FUNCTION IF EXISTS sync_demandcom_to_master();

-- Phase 3: Drop tables (order matters for foreign keys)
DROP TABLE IF EXISTS matching_jobs CASCADE;
DROP TABLE IF EXISTS candidate_match_exclusions CASCADE;
DROP TABLE IF EXISTS master CASCADE;

-- Phase 4: Remove matching columns from candidates table
ALTER TABLE candidates 
  DROP COLUMN IF EXISTS match_score,
  DROP COLUMN IF EXISTS match_insights,
  DROP COLUMN IF EXISTS match_source,
  DROP COLUMN IF EXISTS matched_mandate_id,
  DROP COLUMN IF EXISTS matched_at,
  DROP COLUMN IF EXISTS source_master_id;

-- Phase 5: Remove matching columns from mandate_candidates table
ALTER TABLE mandate_candidates
  DROP COLUMN IF EXISTS match_score,
  DROP COLUMN IF EXISTS match_insights,
  DROP COLUMN IF EXISTS match_source,
  DROP COLUMN IF EXISTS is_ai_matched;