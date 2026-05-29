-- Create sync_demandcom_to_master RPC function
CREATE OR REPLACE FUNCTION sync_demandcom_to_master()
RETURNS TABLE (
  total_processed INTEGER,
  total_inserted INTEGER,
  total_updated INTEGER,
  total_failed INTEGER,
  failed_records JSONB
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_processed INTEGER := 0;
  v_inserted INTEGER := 0;
  v_updated INTEGER := 0;
  v_failed INTEGER := 0;
  v_failed_records JSONB := '[]'::JSONB;
  candidate_record RECORD;
  existing_master_id UUID;
BEGIN
  -- Loop through all candidates
  FOR candidate_record IN 
    SELECT * FROM candidates
  LOOP
    BEGIN
      v_processed := v_processed + 1;
      
      -- Check if phone exists in master
      SELECT id INTO existing_master_id
      FROM master
      WHERE phone = candidate_record.phone
      LIMIT 1;
      
      IF existing_master_id IS NOT NULL THEN
        -- UPDATE existing master record
        UPDATE master SET
          first_name = candidate_record.first_name,
          last_name = candidate_record.last_name,
          email = candidate_record.email,
          phone_secondary = candidate_record.phone_secondary,
          designation = candidate_record.designation,
          current_company = candidate_record.current_company,
          current_location = candidate_record.current_location,
          current_ctc_lakhs = candidate_record.current_ctc_lakhs,
          expected_ctc_lakhs = candidate_record.expected_ctc_lakhs,
          total_experience_years = candidate_record.total_experience_years,
          notice_period_days = candidate_record.notice_period_days,
          key_skills = candidate_record.key_skills,
          highest_qualification = candidate_record.highest_qualification,
          preferred_location = candidate_record.preferred_location,
          languages = candidate_record.languages,
          linkedin_url = candidate_record.linkedin_url,
          resume_url = candidate_record.resume_url,
          source = candidate_record.source,
          position_applied_for = candidate_record.position_applied_for,
          current_status = candidate_record.current_status,
          recruitment_status = candidate_record.recruitment_status,
          interview_stage = candidate_record.interview_stage,
          interviewer_names = candidate_record.interviewer_names,
          interview_dates = candidate_record.interview_dates,
          interview_feedback = candidate_record.interview_feedback,
          rejection_reason = candidate_record.rejection_reason,
          internal_notes = candidate_record.internal_notes,
          rating = candidate_record.rating,
          address = candidate_record.address,
          city = candidate_record.city,
          state = candidate_record.state,
          pincode = candidate_record.pincode,
          country = candidate_record.country,
          location = candidate_record.location,
          latest_disposition = candidate_record.latest_disposition,
          latest_subdisposition = candidate_record.latest_subdisposition,
          last_call_date = candidate_record.last_call_date,
          next_call_date = candidate_record.next_call_date,
          assigned_recruiter = candidate_record.assigned_recruiter,
          assigned_by = candidate_record.assigned_by,
          assigned_at = candidate_record.assigned_at,
          updated_at = NOW()
        WHERE id = existing_master_id;
        
        v_updated := v_updated + 1;
      ELSE
        -- INSERT new master record
        INSERT INTO master (
          phone, first_name, last_name, email, phone_secondary,
          designation, current_company, current_location,
          current_ctc_lakhs, expected_ctc_lakhs, total_experience_years,
          notice_period_days, key_skills, highest_qualification,
          preferred_location, languages, linkedin_url, resume_url,
          source, position_applied_for, current_status,
          recruitment_status, interview_stage, interviewer_names,
          interview_dates, interview_feedback, rejection_reason,
          internal_notes, rating, address, city, state, pincode,
          country, location, latest_disposition, latest_subdisposition,
          last_call_date, next_call_date, assigned_recruiter,
          assigned_by, assigned_at, application_date, created_by
        ) VALUES (
          candidate_record.phone,
          candidate_record.first_name,
          candidate_record.last_name,
          candidate_record.email,
          candidate_record.phone_secondary,
          candidate_record.designation,
          candidate_record.current_company,
          candidate_record.current_location,
          candidate_record.current_ctc_lakhs,
          candidate_record.expected_ctc_lakhs,
          candidate_record.total_experience_years,
          candidate_record.notice_period_days,
          candidate_record.key_skills,
          candidate_record.highest_qualification,
          candidate_record.preferred_location,
          candidate_record.languages,
          candidate_record.linkedin_url,
          candidate_record.resume_url,
          candidate_record.source,
          candidate_record.position_applied_for,
          candidate_record.current_status,
          candidate_record.recruitment_status,
          candidate_record.interview_stage,
          candidate_record.interviewer_names,
          candidate_record.interview_dates,
          candidate_record.interview_feedback,
          candidate_record.rejection_reason,
          candidate_record.internal_notes,
          candidate_record.rating,
          candidate_record.address,
          candidate_record.city,
          candidate_record.state,
          candidate_record.pincode,
          candidate_record.country,
          candidate_record.location,
          candidate_record.latest_disposition,
          candidate_record.latest_subdisposition,
          candidate_record.last_call_date,
          candidate_record.next_call_date,
          candidate_record.assigned_recruiter,
          candidate_record.assigned_by,
          candidate_record.assigned_at,
          candidate_record.application_date,
          candidate_record.created_by
        );
        
        v_inserted := v_inserted + 1;
      END IF;
      
    EXCEPTION WHEN OTHERS THEN
      v_failed := v_failed + 1;
      v_failed_records := v_failed_records || 
        jsonb_build_object(
          'phone', candidate_record.phone,
          'name', candidate_record.first_name || ' ' || candidate_record.last_name,
          'error', SQLERRM
        );
    END;
  END LOOP;
  
  -- Return results
  RETURN QUERY SELECT 
    v_processed,
    v_inserted,
    v_updated,
    v_failed,
    v_failed_records;
END;
$$;