-- Allow public/anonymous users to select profiles by referral_code for public job applications
CREATE POLICY "Anyone can view profile by referral code"
ON public.profiles
FOR SELECT
USING (referral_code IS NOT NULL);