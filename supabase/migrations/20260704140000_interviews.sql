-- Interview scheduling + feedback capture.
-- Rounds are scheduled against a candidate (and optionally a mandate), invites
-- go out by email, and each round records a verdict + rating + notes — so
-- "Interviews Arranged" finally drills down into what happened in them.

create table if not exists public.interviews (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  candidate_id uuid not null references public.candidates(id) on delete cascade,
  mandate_id uuid references public.mandates(id) on delete set null,
  round_name text not null default 'Interview',
  scheduled_at timestamptz not null,
  duration_minutes int not null default 45,
  mode text not null default 'video' check (mode in ('video', 'phone', 'in_person')),
  meeting_link text,
  interviewer_name text,
  interviewer_email text,
  status text not null default 'scheduled' check (status in ('scheduled', 'completed', 'cancelled', 'no_show')),
  verdict text check (verdict in ('strong_yes', 'yes', 'no', 'strong_no')),
  rating int check (rating between 1 and 5),
  feedback text,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_interviews_candidate on public.interviews(candidate_id);
create index if not exists idx_interviews_org_time on public.interviews(org_id, scheduled_at);

alter table public.interviews enable row level security;

drop policy if exists "Org members can view interviews" on public.interviews;
create policy "Org members can view interviews" on public.interviews
  for select to authenticated
  using (is_platform_admin(auth.uid()) or is_org_member(auth.uid(), org_id));

drop policy if exists "Org members can manage interviews" on public.interviews;
create policy "Org members can manage interviews" on public.interviews
  for all to authenticated
  using (is_platform_admin(auth.uid()) or is_org_member(auth.uid(), org_id))
  with check (is_platform_admin(auth.uid()) or is_org_member(auth.uid(), org_id));
