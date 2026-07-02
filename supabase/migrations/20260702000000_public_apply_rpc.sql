-- Fix the public apply flow.
-- Before: the client did `INSERT INTO candidates (...) .select('id')` as the anon role.
-- The INSERT policy allowed it, but the implicit RETURNING/SELECT requires a SELECT
-- policy anon does not have -> RLS 42501, so no candidate was ever created from a
-- public application. It also never set org_id, so any such candidate would be
-- invisible to org members (RLS is keyed on org_id).
--
-- Fix: a SECURITY DEFINER RPC that validates the referral code, then creates the
-- candidate + application rows server-side (setting org_id from the recruiter and
-- linking the application to the new candidate), and returns the candidate id.
-- anon never needs table INSERT/SELECT policies on candidates -> no privacy hole.

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
begin
  select id, org_id into v_rec_id, v_org_id
  from public.profiles
  where referral_code = p_referral_code
  limit 1;

  if v_rec_id is null then
    raise exception 'Invalid referral code';
  end if;

  v_position := coalesce(nullif(p_candidate->>'position_applied_for', ''), 'General Application');

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

  if array_length(p_mandate_ids, 1) is not null then
    insert into public.public_job_applications
      (referral_code, recruiter_id, mandate_id, candidate_id, resume_url, resume_file_name, parsed_data, status)
    select p_referral_code, v_rec_id, m, v_candidate_id, coalesce(p_resume_url, ''), p_resume_file_name, p_parsed_data, 'pending'
    from unnest(p_mandate_ids) as m;
  else
    insert into public.public_job_applications
      (referral_code, recruiter_id, mandate_id, candidate_id, resume_url, resume_file_name, parsed_data, status)
    values (p_referral_code, v_rec_id, null, v_candidate_id, coalesce(p_resume_url, ''), p_resume_file_name, p_parsed_data, 'pending');
  end if;

  return v_candidate_id;
end;
$$;

revoke all     on function public.submit_public_application(text, jsonb, uuid[], text, text, jsonb) from public;
grant  execute on function public.submit_public_application(text, jsonb, uuid[], text, text, jsonb) to anon, authenticated;
