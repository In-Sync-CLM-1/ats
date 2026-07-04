-- Offer module: formal offers with an in-product acceptance link.
-- The offer gets a tokenized public page; the candidate accepts or declines
-- there, the decision is timestamped, the recruiter is notified, and an
-- acceptance moves the candidate's stage to Selected automatically.

create table if not exists public.offers (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  candidate_id uuid not null references public.candidates(id) on delete cascade,
  mandate_id uuid references public.mandates(id) on delete set null,
  ctc_lakhs numeric not null,
  joining_date date not null,
  expiry_date date not null,
  notes text,
  status text not null default 'sent' check (status in ('sent', 'accepted', 'declined', 'expired', 'withdrawn')),
  token text unique not null,
  decline_reason text,
  decided_at timestamptz,
  created_by uuid,
  created_at timestamptz not null default now()
);

alter table public.offers enable row level security;

drop policy if exists "Org members can view offers" on public.offers;
create policy "Org members can view offers" on public.offers
  for select to authenticated
  using (is_platform_admin(auth.uid()) or is_org_member(auth.uid(), org_id));

drop policy if exists "Org members can manage offers" on public.offers;
create policy "Org members can manage offers" on public.offers
  for all to authenticated
  using (is_platform_admin(auth.uid()) or is_org_member(auth.uid(), org_id))
  with check (is_platform_admin(auth.uid()) or is_org_member(auth.uid(), org_id));

-- Allow the offer_update notification type
alter table public.notifications drop constraint if exists notifications_notification_type_check;
alter table public.notifications add constraint notifications_notification_type_check
  check (notification_type = any (array[
    'task_assigned'::text, 'due_soon'::text, 'overdue'::text,
    'ghost_risk'::text, 'client_feedback'::text, 'offer_update'::text
  ]));

-- Public read: the candidate opens their offer with the token
create or replace function public.get_offer(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v record;
begin
  select o.id, o.ctc_lakhs, o.joining_date, o.expiry_date, o.status, o.notes,
         o.decided_at, c.first_name, m.job_title, org.name as org_name,
         cl.company_name
    into v
  from public.offers o
  join public.candidates c on c.id = o.candidate_id
  left join public.mandates m on m.id = o.mandate_id
  left join public.clients cl on cl.id = m.client_id
  left join public.organizations org on org.id = o.org_id
  where o.token = p_token
  limit 1;

  if v.id is null then
    raise exception 'Invalid offer link';
  end if;

  return jsonb_build_object(
    'first_name', v.first_name,
    'job_title', coalesce(v.job_title, 'the offered role'),
    'company_name', coalesce(v.company_name, v.org_name),
    'ctc_lakhs', v.ctc_lakhs,
    'joining_date', v.joining_date,
    'expiry_date', v.expiry_date,
    'status', case when v.status = 'sent' and v.expiry_date < current_date then 'expired' else v.status end,
    'notes', v.notes,
    'decided_at', v.decided_at
  );
end;
$$;

-- Public respond: accept or decline, timestamped; acceptance advances the stage
create or replace function public.respond_to_offer(
  p_token text,
  p_decision text,
  p_reason text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_offer record;
  v_name text;
begin
  if p_decision not in ('accepted', 'declined') then
    raise exception 'Invalid decision';
  end if;

  select o.*, c.first_name || ' ' || c.last_name as cand_name, c.assigned_recruiter
    into v_offer
  from public.offers o
  join public.candidates c on c.id = o.candidate_id
  where o.token = p_token
  limit 1;

  if v_offer.id is null then
    raise exception 'Invalid offer link';
  end if;
  if v_offer.status not in ('sent') then
    raise exception 'This offer has already been %', v_offer.status;
  end if;
  if v_offer.expiry_date < current_date then
    raise exception 'This offer has expired — please contact your recruiter';
  end if;

  update public.offers
     set status = p_decision,
         decline_reason = case when p_decision = 'declined' then nullif(p_reason, '') end,
         decided_at = now()
   where id = v_offer.id;

  if p_decision = 'accepted' then
    update public.candidates
       set interview_stage = 'Selected'
     where id = v_offer.candidate_id;
  end if;

  if v_offer.assigned_recruiter is not null then
    insert into public.notifications (user_id, notification_type, title, message)
    values (
      v_offer.assigned_recruiter,
      'offer_update',
      case when p_decision = 'accepted' then 'Offer accepted 🎉' else 'Offer declined' end,
      v_offer.cand_name || ' has ' || p_decision || ' the offer' ||
        case when p_decision = 'accepted'
          then ' — joining ' || to_char(v_offer.joining_date, 'DD Mon YYYY') || '. Send the onboarding link.'
          else coalesce(': "' || nullif(p_reason, '') || '"', '.')
        end
    );
  end if;
end;
$$;

revoke all    on function public.get_offer(text) from public;
grant execute on function public.get_offer(text) to anon, authenticated;
revoke all    on function public.respond_to_offer(text, text, text) from public;
grant execute on function public.respond_to_offer(text, text, text) to anon, authenticated;
