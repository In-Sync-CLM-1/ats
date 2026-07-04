-- Duplicate guard for the public apply flow: when someone applies with a phone
-- or email that already exists in the org, ATTACH the application to the existing
-- candidate (update resume + mark fresh) instead of creating a second record.
-- "One candidate, one record" survives apply links + referrals + re-applications.

create or replace function public.submit_public_application(
  p_referral_code   text,
  p_candidate       jsonb,
  p_mandate_ids     uuid[] default '{}'::uuid[],
  p_resume_url      text   default null,
  p_resume_file_name text  default null,
  p_parsed_data     jsonb  default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rec_id       uuid;
  v_org_id       uuid;
  v_candidate_id uuid;
  v_position     text;
  v_email        text;
  v_phone        text;
begin
  select id, org_id into v_rec_id, v_org_id
  from public.profiles
  where referral_code = p_referral_code
  limit 1;

  if v_rec_id is null then
    raise exception 'Invalid referral code';
  end if;

  v_position := coalesce(nullif(p_candidate->>'position_applied_for', ''), 'General Application');
  v_email := lower(nullif(p_candidate->>'email', ''));
  v_phone := regexp_replace(coalesce(p_candidate->>'phone', ''), '\D', '', 'g');

  -- Duplicate guard: same email OR same phone within the org = same person
  select id into v_candidate_id
  from public.candidates
  where org_id = v_org_id
    and (
      (v_email is not null and lower(email) = v_email)
      or (length(v_phone) >= 10 and regexp_replace(coalesce(phone, ''), '\D', '', 'g') = v_phone)
    )
  limit 1;

  if v_candidate_id is not null then
    -- Existing candidate re-applying: refresh the résumé + surface as fresh
    update public.candidates
       set resume_url = coalesce(p_resume_url, resume_url),
           is_fresh_application = true,
           application_submitted_at = now(),
           position_applied_for = v_position
     where id = v_candidate_id;
  else
    insert into public.candidates (
      first_name, last_name, email, phone, position_applied_for, current_status,
      resume_url, source, source_recruiter_id, created_by, assigned_recruiter, assigned_at,
      is_fresh_application, application_submitted_at, current_location, current_company,
      designation, total_experience_years, current_ctc_lakhs, expected_ctc_lakhs,
      key_skills, highest_qualification, org_id
    ) values (
      coalesce(nullif(p_candidate->>'first_name', ''), 'Unknown'),
      coalesce(nullif(p_candidate->>'last_name', ''),  'Candidate'),
      nullif(p_candidate->>'email', ''),
      nullif(p_candidate->>'phone', ''),
      v_position, 'applied',
      p_resume_url, 'referral', v_rec_id, v_rec_id, v_rec_id, now(),
      true, now(),
      nullif(p_candidate->>'current_location', ''),
      nullif(p_candidate->>'current_company', ''),
      nullif(p_candidate->>'designation', ''),
      nullif(p_candidate->>'total_experience_years', '')::numeric,
      nullif(p_candidate->>'current_ctc_lakhs', '')::numeric,
      nullif(p_candidate->>'expected_ctc_lakhs', '')::numeric,
      nullif(p_candidate->>'key_skills', ''),
      nullif(p_candidate->>'highest_qualification', ''),
      v_org_id
    )
    returning id into v_candidate_id;
  end if;

  if array_length(p_mandate_ids, 1) is not null then
    insert into public.public_job_applications
      (referral_code, recruiter_id, mandate_id, candidate_id, resume_url, resume_file_name, parsed_data, status)
    select p_referral_code, v_rec_id, m, v_candidate_id, coalesce(p_resume_url, ''), coalesce(p_resume_file_name, ''), p_parsed_data, 'pending'
    from unnest(p_mandate_ids) as m;
  else
    insert into public.public_job_applications
      (referral_code, recruiter_id, mandate_id, candidate_id, resume_url, resume_file_name, parsed_data, status)
    values (p_referral_code, v_rec_id, null, v_candidate_id, coalesce(p_resume_url, ''), coalesce(p_resume_file_name, ''), p_parsed_data, 'pending');
  end if;

  return v_candidate_id;
end;
$$;
