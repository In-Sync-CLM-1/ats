-- Restructure clients table for comprehensive client management
-- Phase 1: Drop old columns that are no longer needed
ALTER TABLE clients DROP COLUMN IF EXISTS birthday_date;
ALTER TABLE clients DROP COLUMN IF EXISTS anniversary_date;
ALTER TABLE clients DROP COLUMN IF EXISTS residence_address;
ALTER TABLE clients DROP COLUMN IF EXISTS linkedin_id;
ALTER TABLE clients DROP COLUMN IF EXISTS company_linkedin_page;

-- Phase 2: Rename existing column
ALTER TABLE clients RENAME COLUMN official_address TO head_office_location;

-- Phase 3: Modify existing columns to enforce new constraints
-- Make company_name NOT NULL (mandatory but not unique - allows multiple contacts from same company)
ALTER TABLE clients ALTER COLUMN company_name SET NOT NULL;

-- Make contact_number NOT NULL and UNIQUE (mandatory and unique - prevents duplicate clients)
ALTER TABLE clients ALTER COLUMN contact_number SET NOT NULL;
ALTER TABLE clients ADD CONSTRAINT clients_contact_number_unique UNIQUE (contact_number);

-- Phase 4: Add new mandatory fields with defaults
ALTER TABLE clients ADD COLUMN IF NOT EXISTS industry_sector TEXT NOT NULL DEFAULT '';
ALTER TABLE clients ADD COLUMN IF NOT EXISTS contact_person_designation TEXT NOT NULL DEFAULT '';
ALTER TABLE clients ADD COLUMN IF NOT EXISTS client_status TEXT NOT NULL DEFAULT 'active' CHECK (client_status IN ('active', 'inactive', 'on_hold'));
ALTER TABLE clients ADD COLUMN IF NOT EXISTS registration_date DATE NOT NULL DEFAULT CURRENT_DATE;

-- Phase 5: Add company details columns
ALTER TABLE clients ADD COLUMN IF NOT EXISTS company_size_employees INTEGER;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS company_website TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS branch_locations JSONB DEFAULT '[]'::jsonb;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS gst_number TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS pan_number TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS company_type TEXT CHECK (company_type IN ('startup', 'mnc', 'sme', 'enterprise'));

-- Phase 6: Add business contact details
ALTER TABLE clients ADD COLUMN IF NOT EXISTS secondary_contact_person TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS secondary_contact_email TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS secondary_contact_phone TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS hr_head_name TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS hr_head_contact TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS hiring_manager_name TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS hiring_manager_contact TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS finance_contact_name TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS finance_contact_email TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS finance_contact_phone TEXT;

-- Phase 7: Add commercial terms columns
ALTER TABLE clients ADD COLUMN IF NOT EXISTS payment_terms_days INTEGER CHECK (payment_terms_days IN (30, 45, 60, 90));
ALTER TABLE clients ADD COLUMN IF NOT EXISTS service_fee_percentage NUMERIC(5,2);
ALTER TABLE clients ADD COLUMN IF NOT EXISTS billing_cycle TEXT CHECK (billing_cycle IN ('monthly', 'quarterly', 'annual'));
ALTER TABLE clients ADD COLUMN IF NOT EXISTS credit_limit NUMERIC(12,2);
ALTER TABLE clients ADD COLUMN IF NOT EXISTS contract_start_date DATE;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS contract_end_date DATE;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS msa_agreement_status TEXT CHECK (msa_agreement_status IN ('pending', 'signed', 'expired', 'under_review'));

-- Phase 8: Add recruitment details columns
ALTER TABLE clients ADD COLUMN IF NOT EXISTS typical_hiring_volume_monthly INTEGER;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS typical_hiring_volume_yearly INTEGER;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS preferred_sourcing_channels TEXT[];
ALTER TABLE clients ADD COLUMN IF NOT EXISTS average_time_to_hire_days INTEGER;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS notice_period_accepted_days INTEGER;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS salary_range_min NUMERIC(12,2);
ALTER TABLE clients ADD COLUMN IF NOT EXISTS salary_range_max NUMERIC(12,2);
ALTER TABLE clients ADD COLUMN IF NOT EXISTS background_verification_required BOOLEAN DEFAULT false;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS background_verification_details TEXT;

-- Phase 9: Add administrative columns
ALTER TABLE clients ADD COLUMN IF NOT EXISTS account_manager_id UUID REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS last_interaction_date TIMESTAMP WITH TIME ZONE;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS internal_notes TEXT;

-- Phase 10: Create performance indexes
CREATE INDEX IF NOT EXISTS idx_clients_account_manager ON clients(account_manager_id);
CREATE INDEX IF NOT EXISTS idx_clients_client_status ON clients(client_status);
CREATE INDEX IF NOT EXISTS idx_clients_contract_dates ON clients(contract_start_date, contract_end_date);
CREATE INDEX IF NOT EXISTS idx_clients_industry_sector ON clients(industry_sector);
CREATE INDEX IF NOT EXISTS idx_clients_company_name ON clients(company_name);

-- Phase 11: Update RLS policies to include account_manager access
DROP POLICY IF EXISTS "Authenticated users can view clients" ON clients;
CREATE POLICY "Authenticated users can view clients"
ON clients FOR SELECT
TO authenticated
USING (
  true OR
  account_manager_id = auth.uid() OR
  can_access_user(auth.uid(), account_manager_id)
);