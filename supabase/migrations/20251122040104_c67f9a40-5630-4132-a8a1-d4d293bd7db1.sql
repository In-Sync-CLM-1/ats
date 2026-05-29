-- =====================================================
-- MANDATES FEATURE: COMPLETE DATABASE RESTRUCTURE
-- Converts projects table to comprehensive job mandates system
-- =====================================================

-- 1. Create mandate ID generation function
CREATE OR REPLACE FUNCTION public.generate_mandate_id()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  next_number INTEGER;
  new_mandate_id TEXT;
BEGIN
  SELECT COALESCE(MAX(CAST(REGEXP_REPLACE(mandate_id, '[^0-9]', '', 'g') AS INTEGER)), 0) + 1
  INTO next_number
  FROM projects
  WHERE mandate_id IS NOT NULL 
    AND mandate_id ~ '^MND-\d+$';
  
  new_mandate_id := 'MND-' || LPAD(next_number::TEXT, 4, '0');
  RETURN new_mandate_id;
END;
$$;

-- 2. Drop obsolete columns from projects table
ALTER TABLE projects
  DROP COLUMN IF EXISTS event_dates,
  DROP COLUMN IF EXISTS contact_id,
  DROP COLUMN IF EXISTS project_source,
  DROP COLUMN IF EXISTS project_value,
  DROP COLUMN IF EXISTS expected_afactor,
  DROP COLUMN IF EXISTS final_afactor;

-- 3. Rename existing columns
ALTER TABLE projects
  RENAME COLUMN project_name TO job_title;

ALTER TABLE projects
  RENAME COLUMN brief TO job_description;

ALTER TABLE projects
  RENAME COLUMN project_number TO mandate_id;

ALTER TABLE projects
  RENAME COLUMN management_fees TO service_fee_percentage;

ALTER TABLE projects
  RENAME COLUMN status TO mandate_status;

ALTER TABLE projects
  RENAME COLUMN closed_reason TO closure_reason;

ALTER TABLE projects
  RENAME COLUMN lost_reason TO lost_reason_backup;

-- 4. Modify existing columns
ALTER TABLE projects
  ALTER COLUMN job_title SET NOT NULL,
  ALTER COLUMN job_description SET NOT NULL,
  ALTER COLUMN mandate_status SET DEFAULT 'open',
  ALTER COLUMN service_fee_percentage SET DEFAULT 0;

-- 5. Add mandate_id generation trigger
CREATE OR REPLACE FUNCTION set_mandate_id()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.mandate_id IS NULL THEN
    NEW.mandate_id := generate_mandate_id();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_set_mandate_id ON projects;
CREATE TRIGGER trigger_set_mandate_id
  BEFORE INSERT ON projects
  FOR EACH ROW
  EXECUTE FUNCTION set_mandate_id();

-- 6. Add core mandate fields - Basic Information
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS number_of_positions INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS job_location TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS employment_type TEXT NOT NULL DEFAULT 'permanent',
  ADD COLUMN IF NOT EXISTS mandate_received_date DATE NOT NULL DEFAULT CURRENT_DATE,
  ADD COLUMN IF NOT EXISTS target_closure_date DATE NOT NULL DEFAULT (CURRENT_DATE + INTERVAL '30 days'),
  ADD COLUMN IF NOT EXISTS priority_level TEXT NOT NULL DEFAULT 'medium';

-- 7. Add job requirements fields
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS min_experience_years NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS max_experience_years NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS minimum_qualification TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS mandatory_skills TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS preferred_skills TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS industry_experience TEXT,
  ADD COLUMN IF NOT EXISTS domain_knowledge TEXT,
  ADD COLUMN IF NOT EXISTS certifications_required TEXT;

-- 8. Add compensation details
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS min_ctc_lakhs NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS max_ctc_lakhs NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS variable_component TEXT,
  ADD COLUMN IF NOT EXISTS other_benefits TEXT,
  ADD COLUMN IF NOT EXISTS notice_period_acceptable INTEGER NOT NULL DEFAULT 30;

-- 9. Add job description details
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS key_responsibilities TEXT,
  ADD COLUMN IF NOT EXISTS reporting_to TEXT,
  ADD COLUMN IF NOT EXISTS team_size INTEGER,
  ADD COLUMN IF NOT EXISTS shift_timings TEXT,
  ADD COLUMN IF NOT EXISTS travel_requirements TEXT,
  ADD COLUMN IF NOT EXISTS work_mode TEXT NOT NULL DEFAULT 'office';

-- 10. Add commercial & process fields
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS replacement_period_days INTEGER NOT NULL DEFAULT 90,
  ADD COLUMN IF NOT EXISTS interview_rounds INTEGER,
  ADD COLUMN IF NOT EXISTS client_turnaround_time TEXT,
  ADD COLUMN IF NOT EXISTS special_requirements TEXT;

-- 11. Add tracking fields
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS assigned_recruiter_id UUID,
  ADD COLUMN IF NOT EXISTS secondary_recruiter_id UUID,
  ADD COLUMN IF NOT EXISTS profiles_submitted INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS profiles_shortlisted INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS profiles_selected INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS positions_filled INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS closed_date DATE;

-- 12. Add administrative fields
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS internal_notes TEXT,
  ADD COLUMN IF NOT EXISTS client_feedback TEXT,
  ADD COLUMN IF NOT EXISTS sourcing_strategy TEXT;

-- 13. Update client_id to UUID if it's not already
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'projects' 
    AND column_name = 'client_id' 
    AND data_type = 'text'
  ) THEN
    -- Create temp column, copy data, drop old, rename
    ALTER TABLE projects ADD COLUMN client_id_new UUID;
    -- Leave as NULL if text can't be converted
    ALTER TABLE projects DROP COLUMN client_id;
    ALTER TABLE projects RENAME COLUMN client_id_new TO client_id;
  END IF;
END $$;

-- 14. Add foreign key constraints
ALTER TABLE projects
  DROP CONSTRAINT IF EXISTS fk_projects_client,
  DROP CONSTRAINT IF EXISTS fk_projects_assigned_recruiter,
  DROP CONSTRAINT IF EXISTS fk_projects_secondary_recruiter;

ALTER TABLE projects
  ADD CONSTRAINT fk_projects_client 
    FOREIGN KEY (client_id) 
    REFERENCES clients(id) 
    ON DELETE SET NULL,
  ADD CONSTRAINT fk_projects_assigned_recruiter 
    FOREIGN KEY (assigned_recruiter_id) 
    REFERENCES profiles(id) 
    ON DELETE SET NULL,
  ADD CONSTRAINT fk_projects_secondary_recruiter 
    FOREIGN KEY (secondary_recruiter_id) 
    REFERENCES profiles(id) 
    ON DELETE SET NULL;

-- 15. Add check constraints
ALTER TABLE projects
  DROP CONSTRAINT IF EXISTS check_experience_range,
  DROP CONSTRAINT IF EXISTS check_ctc_range,
  DROP CONSTRAINT IF EXISTS check_positions_filled,
  DROP CONSTRAINT IF EXISTS check_positive_positions,
  DROP CONSTRAINT IF EXISTS check_closure_date_valid,
  DROP CONSTRAINT IF EXISTS check_service_fee_valid;

ALTER TABLE projects
  ADD CONSTRAINT check_experience_range 
    CHECK (max_experience_years >= min_experience_years),
  ADD CONSTRAINT check_ctc_range 
    CHECK (max_ctc_lakhs >= min_ctc_lakhs),
  ADD CONSTRAINT check_positions_filled 
    CHECK (positions_filled <= number_of_positions AND positions_filled >= 0),
  ADD CONSTRAINT check_positive_positions 
    CHECK (number_of_positions > 0),
  ADD CONSTRAINT check_closure_date_valid
    CHECK (closed_date IS NULL OR closed_date >= mandate_received_date),
  ADD CONSTRAINT check_service_fee_valid
    CHECK (service_fee_percentage >= 0 AND service_fee_percentage <= 100);

-- 16. Add performance indexes
CREATE INDEX IF NOT EXISTS idx_projects_client_id ON projects(client_id);
CREATE INDEX IF NOT EXISTS idx_projects_mandate_status ON projects(mandate_status);
CREATE INDEX IF NOT EXISTS idx_projects_assigned_recruiter ON projects(assigned_recruiter_id);
CREATE INDEX IF NOT EXISTS idx_projects_secondary_recruiter ON projects(secondary_recruiter_id);
CREATE INDEX IF NOT EXISTS idx_projects_priority_level ON projects(priority_level);
CREATE INDEX IF NOT EXISTS idx_projects_target_closure_date ON projects(target_closure_date);
CREATE INDEX IF NOT EXISTS idx_projects_mandate_received_date ON projects(mandate_received_date);
CREATE INDEX IF NOT EXISTS idx_projects_employment_type ON projects(employment_type);
CREATE INDEX IF NOT EXISTS idx_projects_job_location ON projects(job_location);
CREATE INDEX IF NOT EXISTS idx_projects_mandatory_skills ON projects USING GIN(mandatory_skills);
CREATE UNIQUE INDEX IF NOT EXISTS idx_projects_mandate_id ON projects(mandate_id);

-- 17. Create mandate_candidates junction table for candidate associations
CREATE TABLE IF NOT EXISTS mandate_candidates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mandate_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  candidate_id UUID NOT NULL REFERENCES demandcom(id) ON DELETE CASCADE,
  submitted_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  current_stage TEXT NOT NULL DEFAULT 'submitted',
  stage_updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  feedback TEXT,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES profiles(id),
  UNIQUE(mandate_id, candidate_id)
);

-- Add indexes for mandate_candidates
CREATE INDEX IF NOT EXISTS idx_mandate_candidates_mandate ON mandate_candidates(mandate_id);
CREATE INDEX IF NOT EXISTS idx_mandate_candidates_candidate ON mandate_candidates(candidate_id);
CREATE INDEX IF NOT EXISTS idx_mandate_candidates_stage ON mandate_candidates(current_stage);
CREATE INDEX IF NOT EXISTS idx_mandate_candidates_status ON mandate_candidates(status);
CREATE INDEX IF NOT EXISTS idx_mandate_candidates_submitted_date ON mandate_candidates(submitted_date);

-- Add updated_at trigger for mandate_candidates
CREATE TRIGGER update_mandate_candidates_updated_at
  BEFORE UPDATE ON mandate_candidates
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 18. Update RLS policies for mandate_candidates
ALTER TABLE mandate_candidates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view mandate candidates for accessible mandates" ON mandate_candidates;
CREATE POLICY "Users can view mandate candidates for accessible mandates"
  ON mandate_candidates FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = mandate_candidates.mandate_id
      AND can_access_project(auth.uid(), projects.id)
    )
  );

DROP POLICY IF EXISTS "Users can manage mandate candidates for accessible mandates" ON mandate_candidates;
CREATE POLICY "Users can manage mandate candidates for accessible mandates"
  ON mandate_candidates FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = mandate_candidates.mandate_id
      AND can_access_project(auth.uid(), projects.id)
    )
  );

-- 19. Create function to auto-update mandate metrics
CREATE OR REPLACE FUNCTION update_mandate_metrics()
RETURNS TRIGGER AS $$
BEGIN
  -- Update profiles_submitted count
  UPDATE projects
  SET profiles_submitted = (
    SELECT COUNT(*) 
    FROM mandate_candidates 
    WHERE mandate_id = NEW.mandate_id 
    AND status = 'active'
  ),
  -- Update profiles_shortlisted count
  profiles_shortlisted = (
    SELECT COUNT(*) 
    FROM mandate_candidates 
    WHERE mandate_id = NEW.mandate_id 
    AND current_stage IN ('shortlisted', 'interview', 'offer', 'selected')
    AND status = 'active'
  ),
  -- Update profiles_selected count
  profiles_selected = (
    SELECT COUNT(*) 
    FROM mandate_candidates 
    WHERE mandate_id = NEW.mandate_id 
    AND current_stage = 'selected'
    AND status = 'active'
  ),
  updated_at = NOW()
  WHERE id = NEW.mandate_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public';

DROP TRIGGER IF EXISTS trigger_update_mandate_metrics ON mandate_candidates;
CREATE TRIGGER trigger_update_mandate_metrics
  AFTER INSERT OR UPDATE OR DELETE ON mandate_candidates
  FOR EACH ROW
  EXECUTE FUNCTION update_mandate_metrics();

-- 20. Add comment to document table purpose
COMMENT ON TABLE projects IS 'Job mandates/requirements from clients. Previously called projects, now restructured for recruitment mandate management.';
COMMENT ON TABLE mandate_candidates IS 'Junction table linking candidates (demandcom) to job mandates (projects) with submission tracking.';

-- 21. Drop lost_reason_backup if it exists
ALTER TABLE projects DROP COLUMN IF EXISTS lost_reason_backup;