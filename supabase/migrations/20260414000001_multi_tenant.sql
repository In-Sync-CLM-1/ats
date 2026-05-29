-- ============================================================
-- Multi-tenant migration for ATS
-- Creates organizations, org_memberships, org_credentials
-- Adds org_id to all active data tables
-- Rewrites RLS for org-level isolation
-- Provisions "In-Sync" as seed organization
-- ============================================================

-- ============================================================
-- PART A — New tables
-- ============================================================

DO $$ BEGIN
  CREATE TYPE public.org_role AS ENUM ('org_admin', 'member');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.organizations (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                  TEXT NOT NULL,
  slug                  TEXT UNIQUE NOT NULL,
  logo_url              TEXT,
  website               TEXT,
  industry              TEXT,
  plan                  TEXT NOT NULL DEFAULT 'starter',
  created_by            UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  onboarding_completed  BOOLEAN NOT NULL DEFAULT false,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.org_memberships (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id     UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role       public.org_role NOT NULL DEFAULT 'member',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (org_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_org_memberships_user_id  ON public.org_memberships (user_id);
CREATE INDEX IF NOT EXISTS idx_org_memberships_org_user ON public.org_memberships (user_id, org_id);

CREATE TABLE IF NOT EXISTS public.org_credentials (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id               UUID UNIQUE NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  exotel_api_key       TEXT,
  exotel_api_token     TEXT,
  exotel_subdomain     TEXT,
  exotel_account_sid   TEXT,
  exotel_caller_id     TEXT,
  exotel_waba_id       TEXT,
  exotel_sender_number TEXT,
  smtp_host            TEXT,
  smtp_port            INTEGER,
  smtp_user            TEXT,
  smtp_password        TEXT,
  smtp_from_email      TEXT,
  smtp_from_name       TEXT,
  pan_api_key          TEXT,
  aadhaar_api_key      TEXT,
  is_configured        BOOLEAN NOT NULL DEFAULT false,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.organizations   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.org_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.org_credentials ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- PART B — Helper functions
-- ============================================================

CREATE OR REPLACE FUNCTION public.is_platform_admin(_user_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = 'platform_admin');
$$;

CREATE OR REPLACE FUNCTION public.has_org_role(_user_id UUID, _org_id UUID, _role public.org_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT public.is_platform_admin(_user_id)
  OR EXISTS (
    SELECT 1 FROM public.org_memberships
    WHERE user_id = _user_id AND org_id = _org_id
      AND (role = _role OR (_role = 'member' AND role = 'org_admin'))
  );
$$;

CREATE OR REPLACE FUNCTION public.is_org_member(_user_id UUID, _org_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT public.is_platform_admin(_user_id)
  OR EXISTS (SELECT 1 FROM public.org_memberships WHERE user_id = _user_id AND org_id = _org_id);
$$;

CREATE OR REPLACE FUNCTION public.get_user_org_ids(_user_id UUID)
RETURNS SETOF UUID LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT org_id FROM public.org_memberships WHERE user_id = _user_id;
$$;

-- ============================================================
-- PART C — Seed org
-- ============================================================

DO $$
BEGIN
  INSERT INTO public.organizations (id, name, slug, industry, plan, onboarding_completed)
  VALUES ('00000000-0000-0000-0000-000000000001'::uuid, 'In-Sync', 'in-sync', 'Recruitment', 'enterprise', true)
  ON CONFLICT (id) DO NOTHING;
END;
$$;

-- ============================================================
-- PART D — Add org_id columns to existing tables
-- Only references tables that actually exist in this schema.
-- profiles uses SET NULL; all others CASCADE.
-- ============================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL;

ALTER TABLE public.user_roles
  ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.user_designations
  ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.candidates
  ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.mandates
  ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.teams
  ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.team_members
  ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.call_logs
  ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.call_dispositions
  ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.general_tasks
  ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.sites
  ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.whatsapp_templates
  ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.export_jobs
  ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.bulk_import_history
  ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.email_templates
  ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.sms_templates
  ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.pipeline_stages
  ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.designations
  ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.webhook_connectors
  ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;

-- ============================================================
-- PART E — Backfill all rows to seed org + add existing users
-- ============================================================

DO $$
DECLARE seed_org_id UUID := '00000000-0000-0000-0000-000000000001';
BEGIN
  UPDATE public.profiles          SET org_id = seed_org_id WHERE org_id IS NULL;
  UPDATE public.user_roles        SET org_id = seed_org_id WHERE org_id IS NULL;
  UPDATE public.user_designations SET org_id = seed_org_id WHERE org_id IS NULL;
  UPDATE public.candidates        SET org_id = seed_org_id WHERE org_id IS NULL;
  UPDATE public.clients           SET org_id = seed_org_id WHERE org_id IS NULL;
  UPDATE public.mandates          SET org_id = seed_org_id WHERE org_id IS NULL;
  UPDATE public.teams             SET org_id = seed_org_id WHERE org_id IS NULL;
  UPDATE public.team_members      SET org_id = seed_org_id WHERE org_id IS NULL;
  UPDATE public.call_logs         SET org_id = seed_org_id WHERE org_id IS NULL;
  UPDATE public.call_dispositions SET org_id = seed_org_id WHERE org_id IS NULL;
  UPDATE public.general_tasks     SET org_id = seed_org_id WHERE org_id IS NULL;
  UPDATE public.sites             SET org_id = seed_org_id WHERE org_id IS NULL;
  UPDATE public.whatsapp_templates SET org_id = seed_org_id WHERE org_id IS NULL;
  UPDATE public.export_jobs       SET org_id = seed_org_id WHERE org_id IS NULL;
  UPDATE public.bulk_import_history SET org_id = seed_org_id WHERE org_id IS NULL;
  UPDATE public.email_templates   SET org_id = seed_org_id WHERE org_id IS NULL;
  UPDATE public.sms_templates     SET org_id = seed_org_id WHERE org_id IS NULL;
  UPDATE public.pipeline_stages   SET org_id = seed_org_id WHERE org_id IS NULL;
  UPDATE public.designations      SET org_id = seed_org_id WHERE org_id IS NULL;
  UPDATE public.webhook_connectors SET org_id = seed_org_id WHERE org_id IS NULL;
  UPDATE public.jobs              SET org_id = seed_org_id WHERE org_id IS NULL;

  -- Enroll all existing auth users as org_admin of the seed org
  INSERT INTO public.org_memberships (org_id, user_id, role)
  SELECT seed_org_id, id, 'org_admin'::public.org_role
  FROM auth.users
  ON CONFLICT (org_id, user_id) DO NOTHING;
END;
$$;

-- ============================================================
-- PART F — Update unique constraints for multi-tenancy
-- ============================================================

-- designations: title now unique per org
ALTER TABLE public.designations DROP CONSTRAINT IF EXISTS designations_title_key;
ALTER TABLE public.designations ADD CONSTRAINT designations_org_title_key UNIQUE (org_id, title);

-- call_dispositions: disposition now unique per org
ALTER TABLE public.call_dispositions DROP CONSTRAINT IF EXISTS call_dispositions_disposition_key;
ALTER TABLE public.call_dispositions ADD CONSTRAINT call_dispositions_org_disposition_key UNIQUE (org_id, disposition);

-- ============================================================
-- PART G — Indexes on org_id
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_profiles_org_id            ON public.profiles(org_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_org_id          ON public.user_roles(org_id);
CREATE INDEX IF NOT EXISTS idx_candidates_org_id          ON public.candidates(org_id);
CREATE INDEX IF NOT EXISTS idx_clients_org_id             ON public.clients(org_id);
CREATE INDEX IF NOT EXISTS idx_mandates_org_id            ON public.mandates(org_id);
CREATE INDEX IF NOT EXISTS idx_teams_org_id               ON public.teams(org_id);
CREATE INDEX IF NOT EXISTS idx_call_logs_org_id           ON public.call_logs(org_id);
CREATE INDEX IF NOT EXISTS idx_general_tasks_org_id       ON public.general_tasks(org_id);
CREATE INDEX IF NOT EXISTS idx_sites_org_id               ON public.sites(org_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_templates_org_id  ON public.whatsapp_templates(org_id);
CREATE INDEX IF NOT EXISTS idx_bulk_import_history_org_id ON public.bulk_import_history(org_id);

-- ============================================================
-- PART H — Drop all existing RLS policies on affected tables
-- ============================================================

DO $$
DECLARE
  pol RECORD;
  tables TEXT[] := ARRAY[
    -- core tables with org_id
    'profiles', 'user_roles', 'user_designations', 'candidates', 'clients', 'mandates',
    'teams', 'team_members', 'call_logs', 'call_dispositions', 'general_tasks',
    'sites', 'whatsapp_templates', 'export_jobs', 'bulk_import_history',
    'email_templates', 'sms_templates', 'pipeline_stages', 'designations',
    'webhook_connectors', 'jobs',
    -- child tables
    'candidate_resumes', 'demandcom_pipeline', 'mandate_candidates',
    'project_team_members', 'project_team_notifications',
    'site_coordinators', 'site_headcount_agreements',
    'webhook_logs', 'bulk_import_records', 'import_batches', 'import_staging',
    'notifications',
    -- platform tables
    'feature_announcements', 'onboarding_steps', 'onboarding_tours',
    'user_announcement_views', 'user_onboarding_progress',
    'role_metadata', 'password_reset_logs', 'sync_logs', 'sync_status',
    'public_job_applications'
  ];
BEGIN
  FOR pol IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = ANY(tables)
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I',
      pol.policyname, pol.schemaname, pol.tablename);
  END LOOP;
END;
$$;

-- ============================================================
-- PART I — New RLS policies
-- ============================================================

-- ── organizations ────────────────────────────────────────────
CREATE POLICY "Members can view their orgs"
  ON public.organizations FOR SELECT TO authenticated
  USING (
    public.is_platform_admin(auth.uid())
    OR id IN (SELECT public.get_user_org_ids(auth.uid()))
  );

CREATE POLICY "Platform admin can create orgs"
  ON public.organizations FOR INSERT TO authenticated
  WITH CHECK (public.is_platform_admin(auth.uid()));

CREATE POLICY "Org admins can update their org"
  ON public.organizations FOR UPDATE TO authenticated
  USING (public.has_org_role(auth.uid(), id, 'org_admin'));

-- ── org_memberships ───────────────────────────────────────────
CREATE POLICY "Members can view memberships"
  ON public.org_memberships FOR SELECT TO authenticated
  USING (
    public.is_platform_admin(auth.uid())
    OR org_id IN (SELECT public.get_user_org_ids(auth.uid()))
  );

CREATE POLICY "Org admins can insert memberships"
  ON public.org_memberships FOR INSERT TO authenticated
  WITH CHECK (public.has_org_role(auth.uid(), org_id, 'org_admin'));

CREATE POLICY "Org admins can update memberships"
  ON public.org_memberships FOR UPDATE TO authenticated
  USING (public.has_org_role(auth.uid(), org_id, 'org_admin'));

CREATE POLICY "Org admins can delete memberships"
  ON public.org_memberships FOR DELETE TO authenticated
  USING (public.has_org_role(auth.uid(), org_id, 'org_admin'));

-- ── org_credentials ───────────────────────────────────────────
CREATE POLICY "Org admins can view credentials"
  ON public.org_credentials FOR SELECT TO authenticated
  USING (public.has_org_role(auth.uid(), org_id, 'org_admin'));

CREATE POLICY "Org admins can insert credentials"
  ON public.org_credentials FOR INSERT TO authenticated
  WITH CHECK (public.has_org_role(auth.uid(), org_id, 'org_admin'));

CREATE POLICY "Org admins can update credentials"
  ON public.org_credentials FOR UPDATE TO authenticated
  USING (public.has_org_role(auth.uid(), org_id, 'org_admin'));

-- ── profiles ─────────────────────────────────────────────────
CREATE POLICY "Org members can view profiles"
  ON public.profiles FOR SELECT TO authenticated
  USING (
    public.is_platform_admin(auth.uid())
    OR id = auth.uid()
    OR public.is_org_member(auth.uid(), org_id)
  );

CREATE POLICY "Trigger can insert profiles"
  ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users and org admins can update profiles"
  ON public.profiles FOR UPDATE TO authenticated
  USING (
    public.is_platform_admin(auth.uid())
    OR auth.uid() = id
    OR public.has_org_role(auth.uid(), org_id, 'org_admin')
  );

-- ── user_roles ────────────────────────────────────────────────
CREATE POLICY "Org members can view user roles"
  ON public.user_roles FOR SELECT TO authenticated
  USING (
    public.is_platform_admin(auth.uid())
    OR user_id = auth.uid()
    OR public.is_org_member(auth.uid(), org_id)
  );

CREATE POLICY "Org admins can manage user roles"
  ON public.user_roles FOR ALL TO authenticated
  USING (public.is_platform_admin(auth.uid()) OR public.has_org_role(auth.uid(), org_id, 'org_admin'));

-- ── user_designations ─────────────────────────────────────────
CREATE POLICY "Org members can view user_designations"
  ON public.user_designations FOR SELECT TO authenticated
  USING (public.is_platform_admin(auth.uid()) OR public.is_org_member(auth.uid(), org_id));

CREATE POLICY "Org admins can manage user_designations"
  ON public.user_designations FOR ALL TO authenticated
  USING (public.is_platform_admin(auth.uid()) OR public.has_org_role(auth.uid(), org_id, 'org_admin'));

-- ── candidates ────────────────────────────────────────────────
CREATE POLICY "Org members can view candidates"
  ON public.candidates FOR SELECT TO authenticated
  USING (public.is_platform_admin(auth.uid()) OR public.is_org_member(auth.uid(), org_id));

CREATE POLICY "Org members can insert candidates"
  ON public.candidates FOR INSERT TO authenticated
  WITH CHECK (public.is_platform_admin(auth.uid()) OR public.is_org_member(auth.uid(), org_id));

CREATE POLICY "Org members can update candidates"
  ON public.candidates FOR UPDATE TO authenticated
  USING (public.is_platform_admin(auth.uid()) OR public.is_org_member(auth.uid(), org_id));

CREATE POLICY "Org admins can delete candidates"
  ON public.candidates FOR DELETE TO authenticated
  USING (public.is_platform_admin(auth.uid()) OR public.has_org_role(auth.uid(), org_id, 'org_admin'));

-- ── clients ───────────────────────────────────────────────────
CREATE POLICY "Org members can view clients"
  ON public.clients FOR SELECT TO authenticated
  USING (public.is_platform_admin(auth.uid()) OR public.is_org_member(auth.uid(), org_id));

CREATE POLICY "Org members can insert clients"
  ON public.clients FOR INSERT TO authenticated
  WITH CHECK (public.is_platform_admin(auth.uid()) OR public.is_org_member(auth.uid(), org_id));

CREATE POLICY "Org members can update clients"
  ON public.clients FOR UPDATE TO authenticated
  USING (public.is_platform_admin(auth.uid()) OR public.is_org_member(auth.uid(), org_id));

CREATE POLICY "Org admins can delete clients"
  ON public.clients FOR DELETE TO authenticated
  USING (public.is_platform_admin(auth.uid()) OR public.has_org_role(auth.uid(), org_id, 'org_admin'));

-- ── mandates ──────────────────────────────────────────────────
CREATE POLICY "Org members can view mandates"
  ON public.mandates FOR SELECT TO authenticated
  USING (public.is_platform_admin(auth.uid()) OR public.is_org_member(auth.uid(), org_id));

CREATE POLICY "Org members can insert mandates"
  ON public.mandates FOR INSERT TO authenticated
  WITH CHECK (public.is_platform_admin(auth.uid()) OR public.is_org_member(auth.uid(), org_id));

CREATE POLICY "Org members can update mandates"
  ON public.mandates FOR UPDATE TO authenticated
  USING (public.is_platform_admin(auth.uid()) OR public.is_org_member(auth.uid(), org_id));

CREATE POLICY "Org admins can delete mandates"
  ON public.mandates FOR DELETE TO authenticated
  USING (public.is_platform_admin(auth.uid()) OR public.has_org_role(auth.uid(), org_id, 'org_admin'));

-- ── teams ─────────────────────────────────────────────────────
CREATE POLICY "Org members can view teams"
  ON public.teams FOR SELECT TO authenticated
  USING (public.is_platform_admin(auth.uid()) OR public.is_org_member(auth.uid(), org_id));

CREATE POLICY "Org admins can manage teams"
  ON public.teams FOR ALL TO authenticated
  USING (public.is_platform_admin(auth.uid()) OR public.has_org_role(auth.uid(), org_id, 'org_admin'));

-- ── team_members ──────────────────────────────────────────────
CREATE POLICY "Org members can view team_members"
  ON public.team_members FOR SELECT TO authenticated
  USING (public.is_platform_admin(auth.uid()) OR public.is_org_member(auth.uid(), org_id));

CREATE POLICY "Org admins can manage team_members"
  ON public.team_members FOR ALL TO authenticated
  USING (public.is_platform_admin(auth.uid()) OR public.has_org_role(auth.uid(), org_id, 'org_admin'));

-- ── call_logs ─────────────────────────────────────────────────
CREATE POLICY "Org members can view call_logs"
  ON public.call_logs FOR SELECT TO authenticated
  USING (public.is_platform_admin(auth.uid()) OR public.is_org_member(auth.uid(), org_id));

CREATE POLICY "Org members can insert call_logs"
  ON public.call_logs FOR INSERT TO authenticated
  WITH CHECK (public.is_platform_admin(auth.uid()) OR public.is_org_member(auth.uid(), org_id));

CREATE POLICY "Org members can update call_logs"
  ON public.call_logs FOR UPDATE TO authenticated
  USING (public.is_platform_admin(auth.uid()) OR public.is_org_member(auth.uid(), org_id));

-- ── call_dispositions ─────────────────────────────────────────
CREATE POLICY "Org members can view call_dispositions"
  ON public.call_dispositions FOR SELECT TO authenticated
  USING (public.is_platform_admin(auth.uid()) OR public.is_org_member(auth.uid(), org_id));

CREATE POLICY "Org admins can manage call_dispositions"
  ON public.call_dispositions FOR ALL TO authenticated
  USING (public.is_platform_admin(auth.uid()) OR public.has_org_role(auth.uid(), org_id, 'org_admin'));

-- ── general_tasks ─────────────────────────────────────────────
CREATE POLICY "Org members can view general_tasks"
  ON public.general_tasks FOR SELECT TO authenticated
  USING (public.is_platform_admin(auth.uid()) OR public.is_org_member(auth.uid(), org_id));

CREATE POLICY "Org members can manage general_tasks"
  ON public.general_tasks FOR ALL TO authenticated
  USING (public.is_platform_admin(auth.uid()) OR public.is_org_member(auth.uid(), org_id));

-- ── sites ─────────────────────────────────────────────────────
CREATE POLICY "Org members can view sites"
  ON public.sites FOR SELECT TO authenticated
  USING (public.is_platform_admin(auth.uid()) OR public.is_org_member(auth.uid(), org_id));

CREATE POLICY "Org admins can manage sites"
  ON public.sites FOR ALL TO authenticated
  USING (public.is_platform_admin(auth.uid()) OR public.has_org_role(auth.uid(), org_id, 'org_admin'));

-- ── whatsapp_templates ────────────────────────────────────────
CREATE POLICY "Org members can view whatsapp_templates"
  ON public.whatsapp_templates FOR SELECT TO authenticated
  USING (public.is_platform_admin(auth.uid()) OR public.is_org_member(auth.uid(), org_id));

CREATE POLICY "Org admins can manage whatsapp_templates"
  ON public.whatsapp_templates FOR ALL TO authenticated
  USING (public.is_platform_admin(auth.uid()) OR public.has_org_role(auth.uid(), org_id, 'org_admin'));

-- ── export_jobs ───────────────────────────────────────────────
CREATE POLICY "Org members can manage export_jobs"
  ON public.export_jobs FOR ALL TO authenticated
  USING (public.is_platform_admin(auth.uid()) OR public.is_org_member(auth.uid(), org_id));

-- ── bulk_import_history ───────────────────────────────────────
CREATE POLICY "Org members can manage bulk_import_history"
  ON public.bulk_import_history FOR ALL TO authenticated
  USING (public.is_platform_admin(auth.uid()) OR public.is_org_member(auth.uid(), org_id));

-- ── email_templates ───────────────────────────────────────────
CREATE POLICY "Org members can view email_templates"
  ON public.email_templates FOR SELECT TO authenticated
  USING (public.is_platform_admin(auth.uid()) OR public.is_org_member(auth.uid(), org_id));

CREATE POLICY "Org admins can manage email_templates"
  ON public.email_templates FOR ALL TO authenticated
  USING (public.is_platform_admin(auth.uid()) OR public.has_org_role(auth.uid(), org_id, 'org_admin'));

-- ── sms_templates ─────────────────────────────────────────────
CREATE POLICY "Org members can view sms_templates"
  ON public.sms_templates FOR SELECT TO authenticated
  USING (public.is_platform_admin(auth.uid()) OR public.is_org_member(auth.uid(), org_id));

CREATE POLICY "Org admins can manage sms_templates"
  ON public.sms_templates FOR ALL TO authenticated
  USING (public.is_platform_admin(auth.uid()) OR public.has_org_role(auth.uid(), org_id, 'org_admin'));

-- ── pipeline_stages ───────────────────────────────────────────
CREATE POLICY "Org members can view pipeline_stages"
  ON public.pipeline_stages FOR SELECT TO authenticated
  USING (public.is_platform_admin(auth.uid()) OR public.is_org_member(auth.uid(), org_id));

CREATE POLICY "Org admins can manage pipeline_stages"
  ON public.pipeline_stages FOR ALL TO authenticated
  USING (public.is_platform_admin(auth.uid()) OR public.has_org_role(auth.uid(), org_id, 'org_admin'));

-- ── designations ──────────────────────────────────────────────
CREATE POLICY "Org members can view designations"
  ON public.designations FOR SELECT TO authenticated
  USING (public.is_platform_admin(auth.uid()) OR public.is_org_member(auth.uid(), org_id));

CREATE POLICY "Org admins can manage designations"
  ON public.designations FOR ALL TO authenticated
  USING (public.is_platform_admin(auth.uid()) OR public.has_org_role(auth.uid(), org_id, 'org_admin'));

-- ── webhook_connectors ────────────────────────────────────────
CREATE POLICY "Org members can view webhook_connectors"
  ON public.webhook_connectors FOR SELECT TO authenticated
  USING (public.is_platform_admin(auth.uid()) OR public.is_org_member(auth.uid(), org_id));

CREATE POLICY "Org admins can manage webhook_connectors"
  ON public.webhook_connectors FOR ALL TO authenticated
  USING (public.is_platform_admin(auth.uid()) OR public.has_org_role(auth.uid(), org_id, 'org_admin'));

-- ── jobs ──────────────────────────────────────────────────────
CREATE POLICY "Org members can view jobs"
  ON public.jobs FOR SELECT TO authenticated
  USING (public.is_platform_admin(auth.uid()) OR public.is_org_member(auth.uid(), org_id));

CREATE POLICY "Org members can manage jobs"
  ON public.jobs FOR ALL TO authenticated
  USING (public.is_platform_admin(auth.uid()) OR public.is_org_member(auth.uid(), org_id));

-- ── Child tables: RLS via parent ─────────────────────────────

-- candidate_resumes → candidates.org_id
CREATE POLICY "Org members can view candidate_resumes"
  ON public.candidate_resumes FOR SELECT TO authenticated
  USING (
    public.is_platform_admin(auth.uid())
    OR EXISTS (SELECT 1 FROM public.candidates c
               WHERE c.id = candidate_id AND public.is_org_member(auth.uid(), c.org_id))
  );
CREATE POLICY "Org members can manage candidate_resumes"
  ON public.candidate_resumes FOR ALL TO authenticated
  USING (
    public.is_platform_admin(auth.uid())
    OR EXISTS (SELECT 1 FROM public.candidates c
               WHERE c.id = candidate_id AND public.is_org_member(auth.uid(), c.org_id))
  );

-- demandcom_pipeline → candidates.org_id (via demandcom_id FK)
CREATE POLICY "Org members can view demandcom_pipeline"
  ON public.demandcom_pipeline FOR SELECT TO authenticated
  USING (
    public.is_platform_admin(auth.uid())
    OR EXISTS (SELECT 1 FROM public.candidates c
               WHERE c.id = demandcom_id AND public.is_org_member(auth.uid(), c.org_id))
  );
CREATE POLICY "Org members can manage demandcom_pipeline"
  ON public.demandcom_pipeline FOR ALL TO authenticated
  USING (
    public.is_platform_admin(auth.uid())
    OR EXISTS (SELECT 1 FROM public.candidates c
               WHERE c.id = demandcom_id AND public.is_org_member(auth.uid(), c.org_id))
  );

-- mandate_candidates → mandates.org_id
-- NOTE: qualify as mandate_candidates.mandate_id to avoid ambiguity with mandates.mandate_id (text)
CREATE POLICY "Org members can view mandate_candidates"
  ON public.mandate_candidates FOR SELECT TO authenticated
  USING (
    public.is_platform_admin(auth.uid())
    OR EXISTS (SELECT 1 FROM public.mandates m
               WHERE m.id = mandate_candidates.mandate_id AND public.is_org_member(auth.uid(), m.org_id))
  );
CREATE POLICY "Org members can manage mandate_candidates"
  ON public.mandate_candidates FOR ALL TO authenticated
  USING (
    public.is_platform_admin(auth.uid())
    OR EXISTS (SELECT 1 FROM public.mandates m
               WHERE m.id = mandate_candidates.mandate_id AND public.is_org_member(auth.uid(), m.org_id))
  );

-- project_team_members → mandates.org_id (project_id FK)
CREATE POLICY "Org members can view project_team_members"
  ON public.project_team_members FOR SELECT TO authenticated
  USING (
    public.is_platform_admin(auth.uid())
    OR EXISTS (SELECT 1 FROM public.mandates m
               WHERE m.id = project_id AND public.is_org_member(auth.uid(), m.org_id))
  );
CREATE POLICY "Org admins can manage project_team_members"
  ON public.project_team_members FOR ALL TO authenticated
  USING (
    public.is_platform_admin(auth.uid())
    OR EXISTS (SELECT 1 FROM public.mandates m
               WHERE m.id = project_id AND public.has_org_role(auth.uid(), m.org_id, 'org_admin'))
  );

-- project_team_notifications → mandates.org_id (project_id FK)
CREATE POLICY "Org members can view project_team_notifications"
  ON public.project_team_notifications FOR SELECT TO authenticated
  USING (
    public.is_platform_admin(auth.uid())
    OR EXISTS (SELECT 1 FROM public.mandates m
               WHERE m.id = project_id AND public.is_org_member(auth.uid(), m.org_id))
  );
CREATE POLICY "Org members can insert project_team_notifications"
  ON public.project_team_notifications FOR INSERT TO authenticated
  WITH CHECK (true);

-- site_coordinators → sites.org_id
CREATE POLICY "Org members can view site_coordinators"
  ON public.site_coordinators FOR SELECT TO authenticated
  USING (
    public.is_platform_admin(auth.uid())
    OR EXISTS (SELECT 1 FROM public.sites s
               WHERE s.id = site_id AND public.is_org_member(auth.uid(), s.org_id))
  );
CREATE POLICY "Org admins can manage site_coordinators"
  ON public.site_coordinators FOR ALL TO authenticated
  USING (
    public.is_platform_admin(auth.uid())
    OR EXISTS (SELECT 1 FROM public.sites s
               WHERE s.id = site_id AND public.has_org_role(auth.uid(), s.org_id, 'org_admin'))
  );

-- site_headcount_agreements → sites.org_id
CREATE POLICY "Org members can view site_headcount_agreements"
  ON public.site_headcount_agreements FOR SELECT TO authenticated
  USING (
    public.is_platform_admin(auth.uid())
    OR EXISTS (SELECT 1 FROM public.sites s
               WHERE s.id = site_id AND public.is_org_member(auth.uid(), s.org_id))
  );
CREATE POLICY "Org admins can manage site_headcount_agreements"
  ON public.site_headcount_agreements FOR ALL TO authenticated
  USING (
    public.is_platform_admin(auth.uid())
    OR EXISTS (SELECT 1 FROM public.sites s
               WHERE s.id = site_id AND public.has_org_role(auth.uid(), s.org_id, 'org_admin'))
  );

-- webhook_logs → webhook_connectors.org_id
CREATE POLICY "Org members can view webhook_logs"
  ON public.webhook_logs FOR SELECT TO authenticated
  USING (
    public.is_platform_admin(auth.uid())
    OR EXISTS (SELECT 1 FROM public.webhook_connectors w
               WHERE w.id = webhook_connector_id AND public.is_org_member(auth.uid(), w.org_id))
  );
CREATE POLICY "System can insert webhook_logs"
  ON public.webhook_logs FOR INSERT TO authenticated
  WITH CHECK (true);

-- bulk_import_records → bulk_import_history.org_id
CREATE POLICY "Org members can view bulk_import_records"
  ON public.bulk_import_records FOR SELECT TO authenticated
  USING (
    public.is_platform_admin(auth.uid())
    OR EXISTS (SELECT 1 FROM public.bulk_import_history h
               WHERE h.id = import_id AND public.is_org_member(auth.uid(), h.org_id))
  );
CREATE POLICY "System can manage bulk_import_records"
  ON public.bulk_import_records FOR ALL TO authenticated
  USING (true);

-- import_batches → bulk_import_history.org_id
CREATE POLICY "Org members can view import_batches"
  ON public.import_batches FOR SELECT TO authenticated
  USING (
    public.is_platform_admin(auth.uid())
    OR EXISTS (SELECT 1 FROM public.bulk_import_history h
               WHERE h.id = import_id AND public.is_org_member(auth.uid(), h.org_id))
  );
CREATE POLICY "System can manage import_batches"
  ON public.import_batches FOR ALL TO authenticated
  USING (true);

-- import_staging: accessible to any authenticated user (system-managed)
CREATE POLICY "System can manage import_staging"
  ON public.import_staging FOR ALL TO authenticated
  USING (true);

-- notifications: per-user
CREATE POLICY "Users can view own notifications"
  ON public.notifications FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.is_platform_admin(auth.uid()));

CREATE POLICY "System can insert notifications"
  ON public.notifications FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update own notifications"
  ON public.notifications FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

-- ── Platform-level tables (read by all authenticated users) ───

CREATE POLICY "Anyone can read feature_announcements"
  ON public.feature_announcements FOR SELECT TO authenticated USING (true);

CREATE POLICY "Anyone can read onboarding_steps"
  ON public.onboarding_steps FOR SELECT TO authenticated USING (true);

CREATE POLICY "Anyone can read onboarding_tours"
  ON public.onboarding_tours FOR SELECT TO authenticated USING (true);

CREATE POLICY "Anyone can read role_metadata"
  ON public.role_metadata FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users manage own announcement views"
  ON public.user_announcement_views FOR ALL TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users manage own onboarding progress"
  ON public.user_onboarding_progress FOR ALL TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Platform admin can view password_reset_logs"
  ON public.password_reset_logs FOR SELECT TO authenticated
  USING (public.is_platform_admin(auth.uid()));

CREATE POLICY "Anyone can read sync_logs"
  ON public.sync_logs FOR SELECT TO authenticated USING (true);

CREATE POLICY "Anyone can read sync_status"
  ON public.sync_status FOR SELECT TO authenticated USING (true);

-- public_job_applications: fully public (no auth required)
CREATE POLICY "Public can submit job applications"
  ON public.public_job_applications FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Authenticated can view job applications"
  ON public.public_job_applications FOR SELECT TO authenticated USING (true);

-- ============================================================
-- PART J — Update handle_new_user trigger (keep profile insert)
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'full_name')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'agent')
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$;

-- ============================================================
-- PART K — Update send_task_assignment_email with new project URL
-- ============================================================

CREATE OR REPLACE FUNCTION public.send_task_assignment_email()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  task_data RECORD;
  assigned_user_data RECORD;
  assigned_by_data RECORD;
  supabase_url TEXT := 'https://htdwkhtfdifwajdkkpul.supabase.co';
  supabase_anon_key TEXT := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh0ZHdraHRmZGlmd2FqZGtrcHVsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkxMTg4MzQsImV4cCI6MjA5NDY5NDgzNH0.XLkX0XJEMvOgvjFgS52J69HXErR2QjEPdDc09iUk_E8';
BEGIN
  IF (TG_OP = 'INSERT') OR (OLD.assigned_to IS DISTINCT FROM NEW.assigned_to) THEN
    IF NEW.assigned_to IS NOT NULL AND NEW.assigned_to != NEW.assigned_by THEN
      SELECT * INTO task_data FROM project_tasks WHERE id = NEW.id;
      SELECT email, full_name INTO assigned_user_data FROM profiles WHERE id = NEW.assigned_to;
      SELECT full_name INTO assigned_by_data FROM profiles WHERE id = NEW.assigned_by;
      IF assigned_user_data.email IS NOT NULL THEN
        PERFORM net.http_post(
          url := supabase_url || '/functions/v1/send-task-notification-email',
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || supabase_anon_key
          ),
          body := jsonb_build_object(
            'user_id', NEW.assigned_to,
            'task_id', NEW.id,
            'notification_type', 'task_assigned',
            'task_name', task_data.task_name,
            'due_date', task_data.due_date,
            'assigned_by_name', assigned_by_data.full_name
          )
        );
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
