-- Fix broken trigger functions that reference renamed tables,
-- fix mandate_candidates RLS policies, and add anon access for public apply page.

-- ── 1. Fix update_mandate_metrics: projects → mandates ────────────────────────
CREATE OR REPLACE FUNCTION public.update_mandate_metrics()
RETURNS TRIGGER AS $$
DECLARE
  v_mandate_id uuid;
BEGIN
  v_mandate_id := COALESCE(NEW.mandate_id, OLD.mandate_id);
  IF v_mandate_id IS NULL THEN RETURN COALESCE(NEW, OLD); END IF;

  UPDATE public.mandates
  SET
    profiles_submitted = (
      SELECT COUNT(*) FROM public.mandate_candidates
      WHERE mandate_id = v_mandate_id AND status = 'active'
    ),
    profiles_shortlisted = (
      SELECT COUNT(*) FROM public.mandate_candidates
      WHERE mandate_id = v_mandate_id
        AND current_stage IN ('shortlisted', 'interview', 'offer', 'selected')
        AND status = 'active'
    ),
    profiles_selected = (
      SELECT COUNT(*) FROM public.mandate_candidates
      WHERE mandate_id = v_mandate_id
        AND current_stage = 'selected'
        AND status = 'active'
    ),
    updated_at = NOW()
  WHERE id = v_mandate_id;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public';

-- ── 2. Fix update_demandcom_latest_disposition: demandcom → candidates ─────────
CREATE OR REPLACE FUNCTION public.update_demandcom_latest_disposition()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.disposition IS NOT NULL AND NEW.disposition != '' THEN
    UPDATE public.candidates
    SET
      latest_disposition  = NEW.disposition,
      latest_subdisposition = NEW.subdisposition,
      last_call_date       = NEW.disposition_set_at
    WHERE id = NEW.demandcom_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public';

-- ── 3. Fix mandate_candidates RLS: projects → mandates ────────────────────────
DROP POLICY IF EXISTS "Users can view mandate candidates for accessible mandates" ON public.mandate_candidates;
CREATE POLICY "Users can view mandate candidates for accessible mandates"
  ON public.mandate_candidates FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.mandates m
      WHERE m.id = mandate_candidates.mandate_id
        AND public.is_org_member(auth.uid(), m.org_id)
    )
  );

DROP POLICY IF EXISTS "Users can manage mandate candidates for accessible mandates" ON public.mandate_candidates;
CREATE POLICY "Users can manage mandate candidates for accessible mandates"
  ON public.mandate_candidates FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.mandates m
      WHERE m.id = mandate_candidates.mandate_id
        AND public.is_org_member(auth.uid(), m.org_id)
    )
  );

-- ── 4. Anon access for public apply page (/apply/:referralCode) ───────────────
-- Allow anonymous users to look up a recruiter by their referral code
DROP POLICY IF EXISTS "Public can look up profiles by referral code" ON public.profiles;
CREATE POLICY "Public can look up profiles by referral code"
  ON public.profiles FOR SELECT
  TO anon
  USING (referral_code IS NOT NULL);

-- Allow anonymous users to view open mandates (job listings on apply page)
DROP POLICY IF EXISTS "Public can view open mandates" ON public.mandates;
CREATE POLICY "Public can view open mandates"
  ON public.mandates FOR SELECT
  TO anon
  USING (mandate_status = 'open');

-- Allow anonymous users to insert job applications (submit apply form)
DROP POLICY IF EXISTS "Public can submit job applications" ON public.public_job_applications;
CREATE POLICY "Public can submit job applications"
  ON public.public_job_applications FOR INSERT
  TO anon
  WITH CHECK (true);

-- Allow anonymous users to insert candidates (created on apply)
DROP POLICY IF EXISTS "Public can create candidates via apply" ON public.candidates;
CREATE POLICY "Public can create candidates via apply"
  ON public.candidates FOR INSERT
  TO anon
  WITH CHECK (true);
