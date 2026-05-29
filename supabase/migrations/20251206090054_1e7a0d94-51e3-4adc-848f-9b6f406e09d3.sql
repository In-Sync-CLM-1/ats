-- Create candidate_resumes table for storing multiple resumes per candidate
CREATE TABLE public.candidate_resumes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id UUID REFERENCES public.candidates(id) ON DELETE CASCADE NOT NULL,
  file_url TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_type TEXT,
  file_size INTEGER,
  parsed_data JSONB DEFAULT '{}'::jsonb,
  is_primary BOOLEAN DEFAULT false,
  uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  parsed_at TIMESTAMP WITH TIME ZONE,
  uploaded_by UUID REFERENCES public.profiles(id)
);

-- Enable RLS
ALTER TABLE public.candidate_resumes ENABLE ROW LEVEL SECURITY;

-- Create index for faster lookups
CREATE INDEX idx_candidate_resumes_candidate_id ON public.candidate_resumes(candidate_id);

-- RLS Policies
CREATE POLICY "Users can view resumes for accessible candidates"
ON public.candidate_resumes
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.candidates c
    WHERE c.id = candidate_resumes.candidate_id
    AND (
      c.assigned_recruiter = auth.uid()
      OR c.created_by = auth.uid()
      OR has_role(auth.uid(), 'admin'::app_role)
      OR has_role(auth.uid(), 'super_admin'::app_role)
      OR has_role(auth.uid(), 'platform_admin'::app_role)
    )
  )
);

CREATE POLICY "Users can upload resumes"
ON public.candidate_resumes
FOR INSERT
WITH CHECK (auth.uid() = uploaded_by);

CREATE POLICY "Users can update their uploaded resumes"
ON public.candidate_resumes
FOR UPDATE
USING (
  auth.uid() = uploaded_by
  OR has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'super_admin'::app_role)
  OR has_role(auth.uid(), 'platform_admin'::app_role)
);

CREATE POLICY "Users can delete their uploaded resumes"
ON public.candidate_resumes
FOR DELETE
USING (
  auth.uid() = uploaded_by
  OR has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'super_admin'::app_role)
  OR has_role(auth.uid(), 'platform_admin'::app_role)
);

-- Trigger to ensure only one primary resume per candidate
CREATE OR REPLACE FUNCTION public.ensure_single_primary_resume()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.is_primary = true THEN
    UPDATE public.candidate_resumes
    SET is_primary = false
    WHERE candidate_id = NEW.candidate_id
      AND id != NEW.id
      AND is_primary = true;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_ensure_single_primary_resume
BEFORE INSERT OR UPDATE ON public.candidate_resumes
FOR EACH ROW
EXECUTE FUNCTION public.ensure_single_primary_resume();