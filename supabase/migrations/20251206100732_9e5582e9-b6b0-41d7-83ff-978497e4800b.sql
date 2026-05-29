-- Add referral_code to profiles for unique recruiter links
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS referral_code TEXT UNIQUE;

-- Generate referral codes for existing profiles
UPDATE public.profiles 
SET referral_code = LOWER(SUBSTR(MD5(id::text || NOW()::text), 1, 8))
WHERE referral_code IS NULL;

-- Create function to auto-generate referral code for new users
CREATE OR REPLACE FUNCTION public.generate_referral_code()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.referral_code IS NULL THEN
    NEW.referral_code := LOWER(SUBSTR(MD5(NEW.id::text || NOW()::text), 1, 8));
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger to auto-generate referral code
DROP TRIGGER IF EXISTS set_referral_code ON public.profiles;
CREATE TRIGGER set_referral_code
  BEFORE INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.generate_referral_code();

-- Add source tracking to candidates
ALTER TABLE public.candidates 
ADD COLUMN IF NOT EXISTS source_recruiter_id UUID REFERENCES public.profiles(id),
ADD COLUMN IF NOT EXISTS application_submitted_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS is_fresh_application BOOLEAN DEFAULT false;

-- Create index for fresh applications
CREATE INDEX IF NOT EXISTS idx_candidates_fresh_application 
ON public.candidates(is_fresh_application, application_submitted_at);

-- Create public job applications table for unauthenticated submissions
CREATE TABLE IF NOT EXISTS public.public_job_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referral_code TEXT NOT NULL,
  recruiter_id UUID REFERENCES public.profiles(id),
  mandate_id UUID REFERENCES public.mandates(id),
  resume_url TEXT NOT NULL,
  resume_file_name TEXT NOT NULL,
  parsed_data JSONB DEFAULT '{}',
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processed', 'failed')),
  candidate_id UUID REFERENCES public.candidates(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  processed_at TIMESTAMP WITH TIME ZONE,
  ip_address TEXT,
  user_agent TEXT
);

-- Enable RLS
ALTER TABLE public.public_job_applications ENABLE ROW LEVEL SECURITY;

-- Allow public inserts (no auth required)
CREATE POLICY "Anyone can submit applications"
ON public.public_job_applications
FOR INSERT
WITH CHECK (true);

-- Allow public to view their own submissions by resume_url
CREATE POLICY "Public can view own submissions"
ON public.public_job_applications
FOR SELECT
USING (true);

-- Recruiters can view applications with their referral code
CREATE POLICY "Recruiters can manage their applications"
ON public.public_job_applications
FOR ALL
USING (
  recruiter_id = auth.uid() OR
  has_role(auth.uid(), 'admin'::app_role) OR
  has_role(auth.uid(), 'super_admin'::app_role) OR
  has_role(auth.uid(), 'platform_admin'::app_role)
);

-- Allow public to select open mandates (for landing page)
CREATE POLICY "Anyone can view open mandates for application"
ON public.mandates
FOR SELECT
USING (mandate_status = 'open');

-- Storage policy for public resume uploads
INSERT INTO storage.buckets (id, name, public)
VALUES ('public-resumes', 'public-resumes', true)
ON CONFLICT (id) DO NOTHING;

-- Allow anyone to upload to public-resumes bucket
CREATE POLICY "Anyone can upload public resumes"
ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'public-resumes');

-- Allow anyone to read public resumes
CREATE POLICY "Anyone can read public resumes"
ON storage.objects
FOR SELECT
USING (bucket_id = 'public-resumes');