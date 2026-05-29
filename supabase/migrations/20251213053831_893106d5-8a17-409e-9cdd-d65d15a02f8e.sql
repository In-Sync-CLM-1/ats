-- Add columns for male/female requirements
ALTER TABLE site_headcount_agreements 
ADD COLUMN IF NOT EXISTS required_male INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS required_female INTEGER DEFAULT 0;

-- Add a computed column for total required (optional, can calculate in app)
COMMENT ON COLUMN site_headcount_agreements.required_male IS 'Number of male candidates required';
COMMENT ON COLUMN site_headcount_agreements.required_female IS 'Number of female candidates required';