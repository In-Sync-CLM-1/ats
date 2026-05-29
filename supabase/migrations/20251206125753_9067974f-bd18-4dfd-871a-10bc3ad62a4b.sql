-- Add RLS policy for anonymous inserts from referral applications
CREATE POLICY "Allow anonymous insert for referral applications"
ON public.candidates FOR INSERT
TO anon
WITH CHECK (
  source = 'referral' 
  AND source_recruiter_id IS NOT NULL
  AND created_by = source_recruiter_id
);