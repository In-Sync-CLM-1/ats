-- =====================================================
-- ATS TRANSFORMATION: Complete Database Migration
-- Transforms master and demandcom from B2B sales to ATS
-- =====================================================

-- =====================================================
-- PART 1: MASTER TABLE TRANSFORMATION
-- =====================================================

-- Drop B2B Sales Columns
ALTER TABLE master DROP COLUMN IF EXISTS company_name CASCADE;
ALTER TABLE master DROP COLUMN IF EXISTS industry_type CASCADE;
ALTER TABLE master DROP COLUMN IF EXISTS sub_industry CASCADE;
ALTER TABLE master DROP COLUMN IF EXISTS turnover CASCADE;
ALTER TABLE master DROP COLUMN IF EXISTS turnover_link CASCADE;
ALTER TABLE master DROP COLUMN IF EXISTS emp_size CASCADE;
ALTER TABLE master DROP COLUMN IF EXISTS erp_name CASCADE;
ALTER TABLE master DROP COLUMN IF EXISTS website CASCADE;
ALTER TABLE master DROP COLUMN IF EXISTS tier CASCADE;
ALTER TABLE master DROP COLUMN IF EXISTS zone CASCADE;
ALTER TABLE master DROP COLUMN IF EXISTS deppt CASCADE;
ALTER TABLE master DROP COLUMN IF EXISTS job_level_updated CASCADE;
ALTER TABLE master DROP COLUMN IF EXISTS salutation CASCADE;
ALTER TABLE master DROP COLUMN IF EXISTS user_id CASCADE;
ALTER TABLE master DROP COLUMN IF EXISTS source CASCADE;
ALTER TABLE master DROP COLUMN IF EXISTS source_1 CASCADE;
ALTER TABLE master DROP COLUMN IF EXISTS extra CASCADE;
ALTER TABLE master DROP COLUMN IF EXISTS extra_1 CASCADE;
ALTER TABLE master DROP COLUMN IF EXISTS extra_2 CASCADE;
ALTER TABLE master DROP COLUMN IF EXISTS activity_name CASCADE;
ALTER TABLE master DROP COLUMN IF EXISTS associated_member_linkedin CASCADE;
ALTER TABLE master DROP COLUMN IF EXISTS company_linkedin_url CASCADE;

-- Add Core Identity Fields
ALTER TABLE master ADD COLUMN first_name TEXT;
ALTER TABLE master ADD COLUMN last_name TEXT;

-- Migrate existing 'name' data
UPDATE master 
SET 
  first_name = COALESCE(NULLIF(SPLIT_PART(name, ' ', 1), ''), 'Unknown'),
  last_name = COALESCE(NULLIF(SPLIT_PART(name, ' ', 2), ''), '');

-- Make first_name and last_name NOT NULL
ALTER TABLE master ALTER COLUMN first_name SET NOT NULL;
ALTER TABLE master ALTER COLUMN last_name SET NOT NULL;

-- Drop old name column
ALTER TABLE master DROP COLUMN name CASCADE;

-- Rename phone fields
ALTER TABLE master RENAME COLUMN mobile_numb TO phone;
ALTER TABLE master RENAME COLUMN mobile2 TO phone_secondary;

-- Add unique constraint to phone
ALTER TABLE master ADD CONSTRAINT master_phone_unique UNIQUE (phone);

-- Rename email fields
ALTER TABLE master RENAME COLUMN official TO email;
ALTER TABLE master DROP COLUMN IF EXISTS personal_email_id CASCADE;
ALTER TABLE master DROP COLUMN IF EXISTS generic_email_id CASCADE;

-- Add Application Fields
ALTER TABLE master ADD COLUMN position_applied_for TEXT NOT NULL DEFAULT 'Not Specified';
ALTER TABLE master ADD COLUMN application_date TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE master ADD COLUMN current_status TEXT NOT NULL DEFAULT 'applied';
ALTER TABLE master ADD COLUMN resume_url TEXT;
ALTER TABLE master ADD COLUMN source TEXT;

-- Add Experience & Compensation Fields
ALTER TABLE master ADD COLUMN current_company TEXT;
ALTER TABLE master ADD COLUMN total_experience_years NUMERIC(4,1);
ALTER TABLE master ADD COLUMN current_ctc_lakhs NUMERIC(10,2);
ALTER TABLE master ADD COLUMN expected_ctc_lakhs NUMERIC(10,2);
ALTER TABLE master ADD COLUMN notice_period_days INTEGER;

-- Add Interview Tracking Fields
ALTER TABLE master ADD COLUMN interview_stage TEXT;
ALTER TABLE master ADD COLUMN interview_dates JSONB DEFAULT '[]'::jsonb;
ALTER TABLE master ADD COLUMN interviewer_names TEXT;
ALTER TABLE master ADD COLUMN interview_feedback TEXT;
ALTER TABLE master ADD COLUMN rating NUMERIC(2,1) CHECK (rating >= 0 AND rating <= 5);
ALTER TABLE master ADD COLUMN rejection_reason TEXT;

-- Add Profile Fields
ALTER TABLE master ADD COLUMN linkedin_url TEXT;
ALTER TABLE master ADD COLUMN current_location TEXT;
ALTER TABLE master ADD COLUMN preferred_location TEXT;
ALTER TABLE master ADD COLUMN highest_qualification TEXT;
ALTER TABLE master ADD COLUMN key_skills TEXT;
ALTER TABLE master ADD COLUMN languages TEXT;
ALTER TABLE master ADD COLUMN internal_notes TEXT;

-- Migrate existing linkedin to linkedin_url
UPDATE master SET linkedin_url = linkedin WHERE linkedin IS NOT NULL;
ALTER TABLE master DROP COLUMN IF EXISTS linkedin CASCADE;

-- Update Administrative Fields
ALTER TABLE master RENAME COLUMN assigned_to TO assigned_recruiter;
ALTER TABLE master RENAME COLUMN assignment_status TO recruitment_status;

-- Update recruitment_status default
ALTER TABLE master ALTER COLUMN recruitment_status SET DEFAULT 'unassigned';

-- =====================================================
-- PART 2: DEMANDCOM TABLE TRANSFORMATION
-- =====================================================

-- Drop B2B Sales Columns
ALTER TABLE demandcom DROP COLUMN IF EXISTS company_name CASCADE;
ALTER TABLE demandcom DROP COLUMN IF EXISTS industry_type CASCADE;
ALTER TABLE demandcom DROP COLUMN IF EXISTS sub_industry CASCADE;
ALTER TABLE demandcom DROP COLUMN IF EXISTS turnover CASCADE;
ALTER TABLE demandcom DROP COLUMN IF EXISTS turnover_link CASCADE;
ALTER TABLE demandcom DROP COLUMN IF EXISTS emp_size CASCADE;
ALTER TABLE demandcom DROP COLUMN IF EXISTS erp_name CASCADE;
ALTER TABLE demandcom DROP COLUMN IF EXISTS website CASCADE;
ALTER TABLE demandcom DROP COLUMN IF EXISTS tier CASCADE;
ALTER TABLE demandcom DROP COLUMN IF EXISTS zone CASCADE;
ALTER TABLE demandcom DROP COLUMN IF EXISTS deppt CASCADE;
ALTER TABLE demandcom DROP COLUMN IF EXISTS job_level_updated CASCADE;
ALTER TABLE demandcom DROP COLUMN IF EXISTS salutation CASCADE;
ALTER TABLE demandcom DROP COLUMN IF EXISTS user_id CASCADE;
ALTER TABLE demandcom DROP COLUMN IF EXISTS source CASCADE;
ALTER TABLE demandcom DROP COLUMN IF EXISTS source_1 CASCADE;
ALTER TABLE demandcom DROP COLUMN IF EXISTS extra CASCADE;
ALTER TABLE demandcom DROP COLUMN IF EXISTS extra_1 CASCADE;
ALTER TABLE demandcom DROP COLUMN IF EXISTS extra_2 CASCADE;
ALTER TABLE demandcom DROP COLUMN IF EXISTS activity_name CASCADE;
ALTER TABLE demandcom DROP COLUMN IF EXISTS associated_member_linkedin CASCADE;
ALTER TABLE demandcom DROP COLUMN IF EXISTS company_linkedin_url CASCADE;

-- Add Core Identity Fields
ALTER TABLE demandcom ADD COLUMN first_name TEXT;
ALTER TABLE demandcom ADD COLUMN last_name TEXT;

-- Migrate existing 'name' data
UPDATE demandcom 
SET 
  first_name = COALESCE(NULLIF(SPLIT_PART(name, ' ', 1), ''), 'Unknown'),
  last_name = COALESCE(NULLIF(SPLIT_PART(name, ' ', 2), ''), '');

-- Make first_name and last_name NOT NULL
ALTER TABLE demandcom ALTER COLUMN first_name SET NOT NULL;
ALTER TABLE demandcom ALTER COLUMN last_name SET NOT NULL;

-- Drop old name column
ALTER TABLE demandcom DROP COLUMN name CASCADE;

-- Rename phone fields
ALTER TABLE demandcom RENAME COLUMN mobile_numb TO phone;
ALTER TABLE demandcom RENAME COLUMN mobile2 TO phone_secondary;

-- Add unique constraint to phone
ALTER TABLE demandcom ADD CONSTRAINT demandcom_phone_unique UNIQUE (phone);

-- Rename email fields
ALTER TABLE demandcom RENAME COLUMN official TO email;
ALTER TABLE demandcom DROP COLUMN IF EXISTS personal_email_id CASCADE;
ALTER TABLE demandcom DROP COLUMN IF EXISTS generic_email_id CASCADE;

-- Add Application Fields
ALTER TABLE demandcom ADD COLUMN position_applied_for TEXT NOT NULL DEFAULT 'Not Specified';
ALTER TABLE demandcom ADD COLUMN application_date TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE demandcom ADD COLUMN current_status TEXT NOT NULL DEFAULT 'applied';
ALTER TABLE demandcom ADD COLUMN resume_url TEXT;
ALTER TABLE demandcom ADD COLUMN source TEXT;

-- Add Experience & Compensation Fields
ALTER TABLE demandcom ADD COLUMN current_company TEXT;
ALTER TABLE demandcom ADD COLUMN total_experience_years NUMERIC(4,1);
ALTER TABLE demandcom ADD COLUMN current_ctc_lakhs NUMERIC(10,2);
ALTER TABLE demandcom ADD COLUMN expected_ctc_lakhs NUMERIC(10,2);
ALTER TABLE demandcom ADD COLUMN notice_period_days INTEGER;

-- Add Interview Tracking Fields
ALTER TABLE demandcom ADD COLUMN interview_stage TEXT;
ALTER TABLE demandcom ADD COLUMN interview_dates JSONB DEFAULT '[]'::jsonb;
ALTER TABLE demandcom ADD COLUMN interviewer_names TEXT;
ALTER TABLE demandcom ADD COLUMN interview_feedback TEXT;
ALTER TABLE demandcom ADD COLUMN rating NUMERIC(2,1) CHECK (rating >= 0 AND rating <= 5);
ALTER TABLE demandcom ADD COLUMN rejection_reason TEXT;

-- Add Profile Fields
ALTER TABLE demandcom ADD COLUMN linkedin_url TEXT;
ALTER TABLE demandcom ADD COLUMN current_location TEXT;
ALTER TABLE demandcom ADD COLUMN preferred_location TEXT;
ALTER TABLE demandcom ADD COLUMN highest_qualification TEXT;
ALTER TABLE demandcom ADD COLUMN key_skills TEXT;
ALTER TABLE demandcom ADD COLUMN languages TEXT;
ALTER TABLE demandcom ADD COLUMN internal_notes TEXT;

-- Migrate existing linkedin to linkedin_url
UPDATE demandcom SET linkedin_url = linkedin WHERE linkedin IS NOT NULL;
ALTER TABLE demandcom DROP COLUMN IF EXISTS linkedin CASCADE;

-- Update Administrative Fields
ALTER TABLE demandcom RENAME COLUMN assigned_to TO assigned_recruiter;
ALTER TABLE demandcom RENAME COLUMN assignment_status TO recruitment_status;

-- Update recruitment_status default
ALTER TABLE demandcom ALTER COLUMN recruitment_status SET DEFAULT 'unassigned';

-- =====================================================
-- CLEANUP: Drop remarks column from demandcom (not in master)
-- =====================================================
ALTER TABLE demandcom DROP COLUMN IF EXISTS remarks CASCADE;