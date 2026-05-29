-- Phase 1: Database Schema Updates for Hybrid Bulk Import

-- 1. Create import_batches table for batch tracking
CREATE TABLE IF NOT EXISTS public.import_batches (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  import_id UUID NOT NULL REFERENCES bulk_import_history(id) ON DELETE CASCADE,
  batch_number INTEGER NOT NULL,
  offset_start INTEGER NOT NULL,
  batch_size INTEGER NOT NULL,
  status TEXT DEFAULT 'pending',
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Create import_staging table for hybrid processing
CREATE TABLE IF NOT EXISTS public.import_staging (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  import_id UUID NOT NULL,
  row_number INTEGER NOT NULL,
  raw_data JSONB NOT NULL,
  processed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_staging_import_id ON public.import_staging(import_id);
CREATE INDEX IF NOT EXISTS idx_staging_processed ON public.import_staging(import_id, processed);
CREATE INDEX IF NOT EXISTS idx_batches_import_id ON public.import_batches(import_id);

-- 3. Enable RLS on new tables
ALTER TABLE public.import_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.import_staging ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies for import_batches
CREATE POLICY "Users can view their own import batches"
ON public.import_batches FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM bulk_import_history
    WHERE id = import_batches.import_id
    AND user_id = auth.uid()
  )
);

CREATE POLICY "System can manage import batches"
ON public.import_batches FOR ALL
USING (true);

-- 5. RLS Policies for import_staging
CREATE POLICY "System can manage staging data"
ON public.import_staging FOR ALL
USING (true);

-- 6. Create the PostgreSQL function for bulk processing
CREATE OR REPLACE FUNCTION public.process_bulk_import_batch(
  p_import_id UUID,
  p_table_name TEXT,
  p_user_id UUID
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_record RECORD;
  v_new_record_id UUID;
  v_processed INTEGER := 0;
  v_inserted INTEGER := 0;
  v_failed INTEGER := 0;
  v_errors JSONB := '[]'::JSONB;
  v_raw_data JSONB;
BEGIN
  -- Process all unprocessed records from staging
  FOR v_record IN 
    SELECT * FROM import_staging 
    WHERE import_id = p_import_id AND NOT processed
    ORDER BY row_number
  LOOP
    BEGIN
      v_raw_data := v_record.raw_data;
      
      IF p_table_name = 'candidates' THEN
        INSERT INTO candidates (
          first_name,
          last_name,
          email,
          phone,
          phone_secondary,
          location,
          city,
          state,
          pincode,
          address,
          designation,
          current_company,
          total_experience_years,
          current_ctc_lakhs,
          expected_ctc_lakhs,
          notice_period_days,
          highest_qualification,
          key_skills,
          source,
          position_applied_for,
          current_status,
          internal_notes,
          created_by
        ) VALUES (
          COALESCE(v_raw_data->>'first_name', 'Unknown'),
          COALESCE(v_raw_data->>'last_name', ''),
          NULLIF(v_raw_data->>'email', ''),
          NULLIF(v_raw_data->>'phone', ''),
          NULLIF(v_raw_data->>'phone_secondary', ''),
          NULLIF(v_raw_data->>'location', ''),
          NULLIF(v_raw_data->>'city', ''),
          NULLIF(v_raw_data->>'state', ''),
          NULLIF(v_raw_data->>'pincode', ''),
          NULLIF(v_raw_data->>'address', ''),
          NULLIF(v_raw_data->>'designation', ''),
          NULLIF(v_raw_data->>'current_company', ''),
          NULLIF(v_raw_data->>'total_experience_years', '')::NUMERIC,
          NULLIF(v_raw_data->>'current_ctc_lakhs', '')::NUMERIC,
          NULLIF(v_raw_data->>'expected_ctc_lakhs', '')::NUMERIC,
          NULLIF(v_raw_data->>'notice_period_days', '')::INTEGER,
          NULLIF(v_raw_data->>'highest_qualification', ''),
          NULLIF(v_raw_data->>'key_skills', ''),
          COALESCE(NULLIF(v_raw_data->>'source', ''), 'bulk_import'),
          COALESCE(NULLIF(v_raw_data->>'position_applied_for', ''), 'Not Specified'),
          COALESCE(NULLIF(v_raw_data->>'current_status', ''), 'applied'),
          NULLIF(v_raw_data->>'internal_notes', ''),
          p_user_id
        )
        RETURNING id INTO v_new_record_id;

      ELSIF p_table_name = 'clients' THEN
        INSERT INTO clients (
          company_name,
          contact_name,
          contact_number,
          email_id,
          industry_sector,
          contact_person_designation,
          client_status,
          head_office_location,
          company_website,
          gst_number,
          pan_number,
          company_type,
          company_size_employees,
          internal_notes,
          created_by
        ) VALUES (
          COALESCE(v_raw_data->>'company_name', 'Unknown Company'),
          COALESCE(v_raw_data->>'contact_name', 'Unknown Contact'),
          COALESCE(v_raw_data->>'contact_number', ''),
          NULLIF(v_raw_data->>'email_id', ''),
          COALESCE(NULLIF(v_raw_data->>'industry_sector', ''), ''),
          COALESCE(NULLIF(v_raw_data->>'contact_person_designation', ''), ''),
          COALESCE(NULLIF(v_raw_data->>'client_status', ''), 'active'),
          NULLIF(v_raw_data->>'head_office_location', ''),
          NULLIF(v_raw_data->>'company_website', ''),
          NULLIF(v_raw_data->>'gst_number', ''),
          NULLIF(v_raw_data->>'pan_number', ''),
          NULLIF(v_raw_data->>'company_type', ''),
          NULLIF(v_raw_data->>'company_size_employees', '')::INTEGER,
          NULLIF(v_raw_data->>'internal_notes', ''),
          p_user_id
        )
        RETURNING id INTO v_new_record_id;

      ELSIF p_table_name = 'mandates' THEN
        INSERT INTO mandates (
          job_title,
          job_description,
          job_location,
          employment_type,
          number_of_positions,
          min_experience_years,
          max_experience_years,
          min_ctc_lakhs,
          max_ctc_lakhs,
          minimum_qualification,
          mandatory_skills,
          preferred_skills,
          notice_period_acceptable,
          work_mode,
          priority_level,
          mandate_status,
          internal_notes,
          client_id,
          created_by
        ) VALUES (
          COALESCE(v_raw_data->>'job_title', 'Untitled Position'),
          COALESCE(v_raw_data->>'job_description', ''),
          COALESCE(NULLIF(v_raw_data->>'job_location', ''), ''),
          COALESCE(NULLIF(v_raw_data->>'employment_type', ''), 'permanent'),
          COALESCE(NULLIF(v_raw_data->>'number_of_positions', '')::INTEGER, 1),
          COALESCE(NULLIF(v_raw_data->>'min_experience_years', '')::NUMERIC, 0),
          COALESCE(NULLIF(v_raw_data->>'max_experience_years', '')::NUMERIC, 0),
          COALESCE(NULLIF(v_raw_data->>'min_ctc_lakhs', '')::NUMERIC, 0),
          COALESCE(NULLIF(v_raw_data->>'max_ctc_lakhs', '')::NUMERIC, 0),
          COALESCE(NULLIF(v_raw_data->>'minimum_qualification', ''), ''),
          COALESCE(
            CASE 
              WHEN v_raw_data->>'mandatory_skills' IS NOT NULL AND v_raw_data->>'mandatory_skills' != ''
              THEN string_to_array(v_raw_data->>'mandatory_skills', ',')
              ELSE '{}'::TEXT[]
            END,
            '{}'::TEXT[]
          ),
          CASE 
            WHEN v_raw_data->>'preferred_skills' IS NOT NULL AND v_raw_data->>'preferred_skills' != ''
            THEN string_to_array(v_raw_data->>'preferred_skills', ',')
            ELSE NULL
          END,
          COALESCE(NULLIF(v_raw_data->>'notice_period_acceptable', '')::INTEGER, 30),
          COALESCE(NULLIF(v_raw_data->>'work_mode', ''), 'office'),
          COALESCE(NULLIF(v_raw_data->>'priority_level', ''), 'medium'),
          COALESCE(NULLIF(v_raw_data->>'mandate_status', ''), 'open'),
          NULLIF(v_raw_data->>'internal_notes', ''),
          NULLIF(v_raw_data->>'client_id', '')::UUID,
          p_user_id
        )
        RETURNING id INTO v_new_record_id;
      ELSE
        RAISE EXCEPTION 'Unsupported table: %', p_table_name;
      END IF;

      -- Track the inserted record for revert capability
      INSERT INTO bulk_import_records (import_id, record_id, table_name, row_number)
      VALUES (p_import_id, v_new_record_id, p_table_name, v_record.row_number);

      -- Mark as processed
      UPDATE import_staging SET processed = true WHERE id = v_record.id;

      v_inserted := v_inserted + 1;
      v_processed := v_processed + 1;

    EXCEPTION WHEN OTHERS THEN
      v_failed := v_failed + 1;
      v_processed := v_processed + 1;
      v_errors := v_errors || jsonb_build_object(
        'row', v_record.row_number,
        'error', SQLERRM,
        'data', v_raw_data
      );
      
      -- Mark as processed even on failure
      UPDATE import_staging SET processed = true WHERE id = v_record.id;
    END;
  END LOOP;

  -- Update bulk_import_history with results
  UPDATE bulk_import_history
  SET 
    processed_records = COALESCE(processed_records, 0) + v_processed,
    successful_records = COALESCE(successful_records, 0) + v_inserted,
    failed_records = COALESCE(failed_records, 0) + v_failed,
    error_log = COALESCE(error_log, '[]'::JSONB) || v_errors,
    status = CASE 
      WHEN v_failed = 0 THEN 'completed'
      WHEN v_inserted > 0 AND v_failed > 0 THEN 'partial'
      ELSE 'failed'
    END,
    completed_at = now(),
    updated_at = now()
  WHERE id = p_import_id;

  RETURN jsonb_build_object(
    'processed', v_processed,
    'inserted', v_inserted,
    'failed', v_failed,
    'errors', v_errors
  );
END;
$$;