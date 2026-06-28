-- ============================================================
-- AI features: candidate scoring, Bolna AI screening, call analysis
-- ============================================================

-- 1. Extend call_logs for Bolna AI calls and recording analysis
-- call_sid is unique/not-null for Exotel; Bolna calls have no SID, so relax the constraint
ALTER TABLE public.call_logs ALTER COLUMN call_sid DROP NOT NULL;
ALTER TABLE public.call_logs DROP CONSTRAINT IF EXISTS call_logs_call_sid_key;
CREATE UNIQUE INDEX IF NOT EXISTS call_logs_call_sid_unique ON public.call_logs(call_sid) WHERE call_sid IS NOT NULL;

ALTER TABLE public.call_logs
  ADD COLUMN IF NOT EXISTS bolna_execution_id text,
  ADD COLUMN IF NOT EXISTS transcript text,
  ADD COLUMN IF NOT EXISTS analysis_json jsonb,
  ADD COLUMN IF NOT EXISTS analysis_quality_score integer;

-- Allow 'bolna' call method alongside existing 'phone' and 'screen'
ALTER TABLE public.call_logs DROP CONSTRAINT IF EXISTS call_logs_call_method_check;
ALTER TABLE public.call_logs
  ADD CONSTRAINT call_logs_call_method_check
    CHECK (call_method = ANY (ARRAY['phone','screen','bolna']));

CREATE INDEX IF NOT EXISTS idx_call_logs_bolna_execution_id
  ON public.call_logs(bolna_execution_id)
  WHERE bolna_execution_id IS NOT NULL;

-- 2. Add Bolna config to org_credentials
ALTER TABLE public.org_credentials
  ADD COLUMN IF NOT EXISTS bolna_agent_id text,
  ADD COLUMN IF NOT EXISTS bolna_caller_id text;

-- 3. Candidate AI scores (cached, on-demand)
CREATE TABLE IF NOT EXISTS public.candidate_ai_scores (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id  uuid NOT NULL REFERENCES public.candidates(id) ON DELETE CASCADE,
  org_id        uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  score         integer NOT NULL CHECK (score >= 0 AND score <= 100),
  category      text NOT NULL CHECK (category IN ('hire','strong','promising','weak','unqualified')),
  breakdown     jsonb NOT NULL DEFAULT '{}',
  reasoning     text,
  input_hash    text,
  scored_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE(candidate_id)
);

ALTER TABLE public.candidate_ai_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can manage candidate_ai_scores"
  ON public.candidate_ai_scores FOR ALL TO authenticated
  USING (
    public.is_platform_admin(auth.uid())
    OR public.is_org_member(auth.uid(), org_id)
  );

CREATE INDEX IF NOT EXISTS idx_candidate_ai_scores_candidate_id
  ON public.candidate_ai_scores(candidate_id);
CREATE INDEX IF NOT EXISTS idx_candidate_ai_scores_org_id
  ON public.candidate_ai_scores(org_id);
