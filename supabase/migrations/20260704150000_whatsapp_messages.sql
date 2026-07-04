-- Two-way WhatsApp on the candidate timeline.
-- One thread table for both directions: outbound sends are logged here by the
-- sender function, inbound replies arrive via the Exotel webhook and are
-- matched to the candidate by phone. The assigned recruiter is notified on
-- every reply — "every touchpoint logged" stops having a one-way exception.

create table if not exists public.whatsapp_messages (
  id uuid primary key default gen_random_uuid(),
  org_id uuid,
  candidate_id uuid references public.candidates(id) on delete cascade,
  phone text not null,
  direction text not null check (direction in ('inbound', 'outbound')),
  body text not null,
  template_name text,
  exotel_sid text,
  status text not null default 'sent',
  raw jsonb,
  sent_by uuid,
  created_at timestamptz not null default now()
);

create index if not exists idx_wa_messages_candidate on public.whatsapp_messages(candidate_id, created_at);
create index if not exists idx_wa_messages_phone on public.whatsapp_messages(phone);

alter table public.whatsapp_messages enable row level security;

drop policy if exists "Org members can view whatsapp messages" on public.whatsapp_messages;
create policy "Org members can view whatsapp messages" on public.whatsapp_messages
  for select to authenticated
  using (is_platform_admin(auth.uid()) or is_org_member(auth.uid(), org_id));

drop policy if exists "Org members can manage whatsapp messages" on public.whatsapp_messages;
create policy "Org members can manage whatsapp messages" on public.whatsapp_messages
  for all to authenticated
  using (is_platform_admin(auth.uid()) or is_org_member(auth.uid(), org_id))
  with check (is_platform_admin(auth.uid()) or is_org_member(auth.uid(), org_id));

-- Allow the whatsapp_reply notification type
alter table public.notifications drop constraint if exists notifications_notification_type_check;
alter table public.notifications add constraint notifications_notification_type_check
  check (notification_type = any (array[
    'task_assigned'::text, 'due_soon'::text, 'overdue'::text,
    'ghost_risk'::text, 'client_feedback'::text, 'offer_update'::text, 'whatsapp_reply'::text
  ]));
