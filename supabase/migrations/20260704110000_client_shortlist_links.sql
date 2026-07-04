-- Client shortlist links: share a mandate's submitted candidates with the client
-- via a tokenized public page; capture accept / reject / interview feedback.
-- Same SECURITY DEFINER RPC pattern as the public apply flow — anon never gets
-- table policies, and contact details are never exposed to the client.

-- 1. Token on the mandate (generated on demand from the app)
alter table public.mandates add column if not exists shortlist_token text unique;

-- 2. Client feedback lives on the mandate↔candidate link
alter table public.mandate_candidates
  add column if not exists client_decision text
    check (client_decision in ('accepted', 'rejected', 'interview')),
  add column if not exists client_comment text,
  add column if not exists client_decided_at timestamptz;

-- 3. Allow the client_feedback notification type
alter table public.notifications drop constraint if exists notifications_notification_type_check;
alter table public.notifications add constraint notifications_notification_type_check
  check (notification_type = any (array[
    'task_assigned'::text, 'due_soon'::text, 'overdue'::text,
    'ghost_risk'::text, 'client_feedback'::text
  ]));

-- 4. Read the shortlist (public, sanitized: no phone / no email)
create or replace function public.get_client_shortlist(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_mandate record;
  v_candidates jsonb;
begin
  select m.id, m.job_title, m.job_location, m.work_mode,
         m.min_experience_years, m.max_experience_years, m.number_of_positions,
         c.company_name
    into v_mandate
  from public.mandates m
  left join public.clients c on c.id = m.client_id
  where m.shortlist_token = p_token
  limit 1;

  if v_mandate.id is null then
    raise exception 'Invalid shortlist link';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'candidate_id', cd.id,
    'name', cd.first_name || ' ' || cd.last_name,
    'designation', cd.designation,
    'current_company', cd.current_company,
    'experience_years', cd.total_experience_years,
    'notice_period_days', cd.notice_period_days,
    'key_skills', cd.key_skills,
    'location', cd.current_location,
    'stage', mc.current_stage,
    'client_decision', mc.client_decision,
    'client_comment', mc.client_comment
  ) order by cd.first_name), '[]'::jsonb)
    into v_candidates
  from public.mandate_candidates mc
  join public.candidates cd on cd.id = mc.candidate_id
  where mc.mandate_id = v_mandate.id
    and mc.status = 'active';

  return jsonb_build_object(
    'job_title', v_mandate.job_title,
    'company_name', v_mandate.company_name,
    'location', v_mandate.job_location,
    'work_mode', v_mandate.work_mode,
    'min_experience_years', v_mandate.min_experience_years,
    'max_experience_years', v_mandate.max_experience_years,
    'number_of_positions', v_mandate.number_of_positions,
    'candidates', v_candidates
  );
end;
$$;

-- 5. Record the client's decision + notify the mandate's recruiter
create or replace function public.submit_client_feedback(
  p_token text,
  p_candidate_id uuid,
  p_decision text,
  p_comment text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_mandate record;
  v_name text;
begin
  if p_decision not in ('accepted', 'rejected', 'interview') then
    raise exception 'Invalid decision';
  end if;

  select id, job_title, assigned_recruiter_id into v_mandate
  from public.mandates
  where shortlist_token = p_token
  limit 1;

  if v_mandate.id is null then
    raise exception 'Invalid shortlist link';
  end if;

  update public.mandate_candidates
     set client_decision = p_decision,
         client_comment = nullif(p_comment, ''),
         client_decided_at = now()
   where mandate_id = v_mandate.id
     and candidate_id = p_candidate_id;

  if not found then
    raise exception 'Candidate not on this shortlist';
  end if;

  select first_name || ' ' || last_name into v_name
  from public.candidates where id = p_candidate_id;

  if v_mandate.assigned_recruiter_id is not null then
    insert into public.notifications (user_id, notification_type, title, message)
    values (
      v_mandate.assigned_recruiter_id,
      'client_feedback',
      'Client feedback received',
      'Client marked ' || coalesce(v_name, 'a candidate') || ' as "' || p_decision ||
        '" for ' || v_mandate.job_title ||
        case when nullif(p_comment, '') is not null then ' — "' || p_comment || '"' else '' end
    );
  end if;
end;
$$;

revoke all    on function public.get_client_shortlist(text) from public;
grant execute on function public.get_client_shortlist(text) to anon, authenticated;
revoke all    on function public.submit_client_feedback(text, uuid, text, text) from public;
grant execute on function public.submit_client_feedback(text, uuid, text, text) to anon, authenticated;
