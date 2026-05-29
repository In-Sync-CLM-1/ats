-- ============================================================
-- org-logos storage bucket for organization logos uploaded
-- during onboarding (and updateable by org admins later).
-- ============================================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('org-logos', 'org-logos', true)
ON CONFLICT (id) DO NOTHING;

-- Public read
DROP POLICY IF EXISTS "Public can read org logos" ON storage.objects;
CREATE POLICY "Public can read org logos"
  ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'org-logos');

-- Authenticated users can upload (any path under their org)
DROP POLICY IF EXISTS "Authenticated can upload org logos" ON storage.objects;
CREATE POLICY "Authenticated can upload org logos"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'org-logos');

-- Authenticated users can update their own uploads
DROP POLICY IF EXISTS "Authenticated can update org logos" ON storage.objects;
CREATE POLICY "Authenticated can update org logos"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'org-logos');

DROP POLICY IF EXISTS "Authenticated can delete org logos" ON storage.objects;
CREATE POLICY "Authenticated can delete org logos"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'org-logos');
