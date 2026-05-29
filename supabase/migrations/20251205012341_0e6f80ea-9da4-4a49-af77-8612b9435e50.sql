-- Create resumes bucket
INSERT INTO storage.buckets (id, name, public) 
VALUES ('resumes', 'resumes', true)
ON CONFLICT (id) DO NOTHING;

-- RLS policy for authenticated upload
CREATE POLICY "Allow authenticated uploads on resumes" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'resumes');

-- RLS policy for authenticated read
CREATE POLICY "Allow authenticated read on resumes" ON storage.objects
FOR SELECT TO authenticated
USING (bucket_id = 'resumes');

-- RLS policy for authenticated delete (for cleanup)
CREATE POLICY "Allow authenticated delete on resumes" ON storage.objects
FOR DELETE TO authenticated
USING (bucket_id = 'resumes');