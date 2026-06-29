-- Allow public careers page to read org info by slug (anon)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'organizations'
      AND policyname = 'Public can view org info for careers page'
  ) THEN
    CREATE POLICY "Public can view org info for careers page"
      ON public.organizations FOR SELECT TO anon
      USING (slug IS NOT NULL);
  END IF;
END $$;
