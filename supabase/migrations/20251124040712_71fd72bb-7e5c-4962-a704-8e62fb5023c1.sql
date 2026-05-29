-- Phase 1: Add matching fields to master table
ALTER TABLE master
ADD COLUMN IF NOT EXISTS matched_mandate_id uuid,
ADD COLUMN IF NOT EXISTS match_score numeric CHECK (match_score >= 0 AND match_score <= 100),
ADD COLUMN IF NOT EXISTS matched_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS match_source text CHECK (match_source IN ('auto', 'manual')),
ADD COLUMN IF NOT EXISTS match_insights jsonb DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS excluded_mandate_ids jsonb DEFAULT '[]'::jsonb;

-- Add matching fields to candidates table
ALTER TABLE candidates
ADD COLUMN IF NOT EXISTS matched_mandate_id uuid,
ADD COLUMN IF NOT EXISTS match_score numeric CHECK (match_score >= 0 AND match_score <= 100),
ADD COLUMN IF NOT EXISTS matched_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS match_source text CHECK (match_source IN ('auto', 'manual')),
ADD COLUMN IF NOT EXISTS match_insights jsonb DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS source_master_id uuid;

-- Update mandate_candidates table
ALTER TABLE mandate_candidates
ADD COLUMN IF NOT EXISTS match_score numeric CHECK (match_score >= 0 AND match_score <= 100),
ADD COLUMN IF NOT EXISTS match_insights jsonb DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS match_source text DEFAULT 'manual' CHECK (match_source IN ('auto', 'manual')),
ADD COLUMN IF NOT EXISTS is_ai_matched boolean DEFAULT false;

-- Create matching_jobs table
CREATE TABLE IF NOT EXISTS matching_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mandate_id uuid NOT NULL REFERENCES mandates(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  total_candidates integer,
  processed_candidates integer DEFAULT 0,
  matched_candidates integer DEFAULT 0,
  current_batch integer DEFAULT 0,
  total_batches integer,
  started_at timestamp with time zone,
  completed_at timestamp with time zone,
  error_message text,
  triggered_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  trigger_type text NOT NULL CHECK (trigger_type IN ('auto_create', 'manual_button', 'auto_update')),
  created_at timestamp with time zone DEFAULT now()
);

-- Create candidate_match_exclusions table
CREATE TABLE IF NOT EXISTS candidate_match_exclusions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  master_id uuid NOT NULL,
  mandate_id uuid NOT NULL REFERENCES mandates(id) ON DELETE CASCADE,
  excluded_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  excluded_at timestamp with time zone DEFAULT now(),
  reason text,
  UNIQUE(master_id, mandate_id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_master_matched_mandate ON master(matched_mandate_id);
CREATE INDEX IF NOT EXISTS idx_master_match_score ON master(match_score DESC) WHERE match_score IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_candidates_matched_mandate ON candidates(matched_mandate_id);
CREATE INDEX IF NOT EXISTS idx_candidates_match_score ON candidates(match_score DESC) WHERE match_score IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_matching_jobs_mandate ON matching_jobs(mandate_id);
CREATE INDEX IF NOT EXISTS idx_matching_jobs_status ON matching_jobs(status);
CREATE INDEX IF NOT EXISTS idx_exclusions_master ON candidate_match_exclusions(master_id);
CREATE INDEX IF NOT EXISTS idx_exclusions_mandate ON candidate_match_exclusions(mandate_id);

-- Enable RLS on new tables
ALTER TABLE matching_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE candidate_match_exclusions ENABLE ROW LEVEL SECURITY;

-- RLS policies for matching_jobs
CREATE POLICY "Users can view their own matching jobs"
  ON matching_jobs FOR SELECT
  USING (
    auth.uid() = triggered_by OR
    has_role(auth.uid(), 'admin'::app_role) OR
    has_role(auth.uid(), 'super_admin'::app_role) OR
    has_role(auth.uid(), 'platform_admin'::app_role)
  );

CREATE POLICY "System can insert matching jobs"
  ON matching_jobs FOR INSERT
  WITH CHECK (true);

CREATE POLICY "System can update matching jobs"
  ON matching_jobs FOR UPDATE
  USING (true);

-- RLS policies for candidate_match_exclusions
CREATE POLICY "Users can view exclusions"
  ON candidate_match_exclusions FOR SELECT
  USING (
    has_role(auth.uid(), 'admin'::app_role) OR
    has_role(auth.uid(), 'super_admin'::app_role) OR
    has_role(auth.uid(), 'platform_admin'::app_role)
  );

CREATE POLICY "Users can create exclusions"
  ON candidate_match_exclusions FOR INSERT
  WITH CHECK (auth.uid() = excluded_by);

CREATE POLICY "Users can delete their exclusions"
  ON candidate_match_exclusions FOR DELETE
  USING (auth.uid() = excluded_by);

-- Enable realtime for matching_jobs
ALTER PUBLICATION supabase_realtime ADD TABLE matching_jobs;