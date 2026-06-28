-- ============================================================
-- Candidate Onboarding: forms, submissions, documents, OTP
-- ============================================================

-- Onboarding forms (HR creates one per batch / position)
CREATE TABLE IF NOT EXISTS public.onboarding_forms (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  description TEXT,
  slug        TEXT NOT NULL UNIQUE,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_by  UUID REFERENCES public.profiles(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.onboarding_forms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can manage onboarding forms"
  ON public.onboarding_forms FOR ALL TO authenticated
  USING (public.is_platform_admin(auth.uid()) OR public.is_org_member(auth.uid(), org_id));

CREATE POLICY "Anyone can read active onboarding forms"
  ON public.onboarding_forms FOR SELECT
  USING (is_active = true);

-- Onboarding submissions (candidates fill this)
CREATE TABLE IF NOT EXISTS public.onboarding_submissions (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  form_id                  UUID NOT NULL REFERENCES public.onboarding_forms(id) ON DELETE CASCADE,
  org_id                   UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  candidate_id             UUID REFERENCES public.candidates(id) ON DELETE SET NULL,
  -- personal
  full_name                TEXT NOT NULL,
  gender                   TEXT,
  date_of_birth            DATE,
  marital_status           TEXT,
  blood_group              TEXT,
  qualifications           TEXT,
  -- contact
  contact_number           TEXT NOT NULL,
  personal_email           TEXT NOT NULL,
  email_verified           BOOLEAN NOT NULL DEFAULT false,
  -- government IDs
  pan_number               TEXT,
  aadhar_number            TEXT,
  uan_number               TEXT,
  -- family
  father_name              TEXT,
  mother_name              TEXT,
  emergency_contact_number TEXT,
  -- address
  present_address          TEXT,
  permanent_address        TEXT,
  -- bank
  bank_name                TEXT,
  account_number           TEXT,
  ifsc_code                TEXT,
  branch_name              TEXT,
  -- review
  status                   TEXT NOT NULL DEFAULT 'pending'
                             CHECK (status IN ('pending','documents_under_review','approved','rejected')),
  ai_review_result         JSONB,
  ai_review_at             TIMESTAMPTZ,
  reviewed_by              UUID REFERENCES public.profiles(id),
  reviewed_at              TIMESTAMPTZ,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.onboarding_submissions ENABLE ROW LEVEL SECURITY;

-- Public (unauthenticated) inserts allowed - this is filled from the public form
CREATE POLICY "Anyone can submit onboarding forms"
  ON public.onboarding_submissions FOR INSERT WITH CHECK (true);

CREATE POLICY "Org members can view/update submissions"
  ON public.onboarding_submissions FOR ALL TO authenticated
  USING (public.is_platform_admin(auth.uid()) OR public.is_org_member(auth.uid(), org_id));

-- Onboarding documents
CREATE TABLE IF NOT EXISTS public.onboarding_documents (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id UUID NOT NULL REFERENCES public.onboarding_submissions(id) ON DELETE CASCADE,
  document_type TEXT NOT NULL,
  file_path     TEXT NOT NULL,
  file_name     TEXT NOT NULL,
  file_size     BIGINT,
  verified      BOOLEAN NOT NULL DEFAULT false,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.onboarding_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can upload onboarding documents"
  ON public.onboarding_documents FOR INSERT WITH CHECK (true);

CREATE POLICY "Org members can view onboarding documents"
  ON public.onboarding_documents FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.onboarding_submissions s
      WHERE s.id = submission_id
        AND (public.is_platform_admin(auth.uid()) OR public.is_org_member(auth.uid(), s.org_id))
    )
  );

-- OTP verifications (used by public form for email verification)
CREATE TABLE IF NOT EXISTS public.onboarding_otp_verifications (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact    TEXT NOT NULL,
  otp_code   TEXT NOT NULL,
  type       TEXT NOT NULL CHECK (type IN ('email','phone')),
  verified   BOOLEAN NOT NULL DEFAULT false,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.onboarding_otp_verifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can insert OTP verifications"   ON public.onboarding_otp_verifications FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can read OTP verifications"     ON public.onboarding_otp_verifications FOR SELECT USING (true);
CREATE POLICY "Anyone can update OTP verifications"   ON public.onboarding_otp_verifications FOR UPDATE USING (true);

-- Storage bucket for uploaded documents
INSERT INTO storage.buckets (id, name, public)
  VALUES ('onboarding-documents', 'onboarding-documents', false)
  ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Anyone can upload onboarding docs storage"
  ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'onboarding-documents');

CREATE POLICY "Authenticated users can read onboarding docs storage"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'onboarding-documents');

-- Triggers
CREATE TRIGGER update_onboarding_forms_updated_at
  BEFORE UPDATE ON public.onboarding_forms
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_onboarding_submissions_updated_at
  BEFORE UPDATE ON public.onboarding_submissions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Indexes
CREATE INDEX IF NOT EXISTS idx_onboarding_forms_org_id    ON public.onboarding_forms(org_id);
CREATE INDEX IF NOT EXISTS idx_onboarding_forms_slug      ON public.onboarding_forms(slug);
CREATE INDEX IF NOT EXISTS idx_onboarding_subs_form_id    ON public.onboarding_submissions(form_id);
CREATE INDEX IF NOT EXISTS idx_onboarding_subs_org_id     ON public.onboarding_submissions(org_id);
CREATE INDEX IF NOT EXISTS idx_onboarding_subs_candidate  ON public.onboarding_submissions(candidate_id);

-- RPC: Approve submission and mark candidate as onboarded
CREATE OR REPLACE FUNCTION public.approve_candidate_onboarding(
  p_submission_id UUID,
  p_reviewer_id   UUID
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_sub RECORD;
BEGIN
  SELECT * INTO v_sub FROM public.onboarding_submissions WHERE id = p_submission_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Submission not found';
  END IF;

  -- Mark submission approved
  UPDATE public.onboarding_submissions SET
    status      = 'approved',
    reviewed_by = p_reviewer_id,
    reviewed_at = now()
  WHERE id = p_submission_id;

  -- Update candidate record if linked
  IF v_sub.candidate_id IS NOT NULL THEN
    UPDATE public.candidates SET
      interview_stage  = 'Joined',
      current_status   = 'onboarded',
      is_onboarded     = true,
      pan_number       = COALESCE(NULLIF(pan_number, ''), v_sub.pan_number),
      aadhar_number    = COALESCE(NULLIF(aadhar_number, ''), v_sub.aadhar_number)
    WHERE id = v_sub.candidate_id;
  END IF;
END;
$$;

-- Add onboarding columns to candidates table
ALTER TABLE public.candidates
  ADD COLUMN IF NOT EXISTS is_onboarded   BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS pan_number     TEXT,
  ADD COLUMN IF NOT EXISTS aadhar_number  TEXT;
