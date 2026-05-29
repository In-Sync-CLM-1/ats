-- Add PAN verification fields to candidates table
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS pan_number TEXT;
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS pan_verified BOOLEAN DEFAULT false;
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS pan_verified_name TEXT;
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS pan_category TEXT;
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS pan_aadhaar_linked TEXT;
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS pan_verification_ref TEXT;

-- Add Aadhaar verification fields to candidates table
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS aadhaar_number_masked TEXT;
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS aadhaar_verified BOOLEAN DEFAULT false;
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS aadhaar_verified_name TEXT;
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS aadhaar_verified_dob TEXT;
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS aadhaar_verified_gender TEXT;
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS aadhaar_verified_address TEXT;
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS aadhaar_verification_ref TEXT;

-- Add KYC metadata fields
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS kyc_completed_at TIMESTAMPTZ;
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS kyc_provider TEXT DEFAULT 'sandbox';