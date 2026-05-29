-- Add new columns to whatsapp_templates table for enhanced features
ALTER TABLE public.whatsapp_templates 
ADD COLUMN IF NOT EXISTS header_type text DEFAULT 'none' CHECK (header_type IN ('none', 'text', 'image', 'video', 'document', 'location')),
ADD COLUMN IF NOT EXISTS header_content text,
ADD COLUMN IF NOT EXISTS footer text,
ADD COLUMN IF NOT EXISTS buttons jsonb DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS language_code text DEFAULT 'en',
ADD COLUMN IF NOT EXISTS variable_mapping jsonb DEFAULT '{}'::jsonb;

-- Add comments for documentation
COMMENT ON COLUMN public.whatsapp_templates.header_type IS 'Type of header: none, text, image, video, document, location';
COMMENT ON COLUMN public.whatsapp_templates.header_content IS 'Header content - URL for media or text for text headers';
COMMENT ON COLUMN public.whatsapp_templates.footer IS 'Optional footer text (max 60 chars)';
COMMENT ON COLUMN public.whatsapp_templates.buttons IS 'JSON array of button configurations';
COMMENT ON COLUMN public.whatsapp_templates.language_code IS 'Template language code e.g. en, en_US, hi';
COMMENT ON COLUMN public.whatsapp_templates.variable_mapping IS 'Maps numbered variables {{1}} to candidate fields';