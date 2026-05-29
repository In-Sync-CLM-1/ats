-- Add zonal_coordinator role to existing enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'zonal_coordinator';

-- Create sites table
CREATE TABLE public.sites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  site_name text NOT NULL,
  site_code text,
  location text,
  address text,
  contact_person text,
  contact_phone text,
  contact_email text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(client_id, site_name)
);

-- Create site_coordinators junction table (many-to-many: coordinators to sites)
CREATE TABLE public.site_coordinators (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  assigned_at timestamptz DEFAULT now(),
  assigned_by uuid REFERENCES public.profiles(id),
  UNIQUE(site_id, user_id)
);

-- Create site_headcount_agreements table
CREATE TABLE public.site_headcount_agreements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  job_title text NOT NULL,
  agreed_headcount integer NOT NULL DEFAULT 0,
  available_headcount integer NOT NULL DEFAULT 0,
  open_positions integer GENERATED ALWAYS AS (
    GREATEST(0, agreed_headcount - available_headcount)
  ) STORED,
  linked_mandate_id uuid REFERENCES public.mandates(id) ON DELETE SET NULL,
  last_updated_by uuid REFERENCES public.profiles(id),
  last_updated_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  notes text,
  UNIQUE(site_id, job_title)
);

-- Create access control function for sites
CREATE OR REPLACE FUNCTION public.can_access_site(_user_id uuid, _site_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM site_coordinators
    WHERE site_id = _site_id AND user_id = _user_id
  )
  OR has_role(_user_id, 'admin'::app_role)
  OR has_role(_user_id, 'super_admin'::app_role)
  OR has_role(_user_id, 'platform_admin'::app_role)
  OR has_role(_user_id, 'admin_tech'::app_role)
  OR has_role(_user_id, 'admin_administration'::app_role)
$$;

-- Function to auto-create/update mandates when open_positions changes
CREATE OR REPLACE FUNCTION public.sync_headcount_to_mandates()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  site_record RECORD;
  new_mandate_id uuid;
BEGIN
  -- Get site and client info
  SELECT s.*, c.id as client_id, c.company_name
  INTO site_record
  FROM sites s
  JOIN clients c ON c.id = s.client_id
  WHERE s.id = NEW.site_id;

  -- If open_positions > 0 and no linked mandate, create one
  IF NEW.open_positions > 0 AND NEW.linked_mandate_id IS NULL THEN
    INSERT INTO mandates (
      client_id,
      job_title,
      job_description,
      job_location,
      number_of_positions,
      mandate_status,
      created_by,
      internal_notes
    ) VALUES (
      site_record.client_id,
      NEW.job_title,
      'Auto-created from headcount agreement for site: ' || site_record.site_name,
      COALESCE(site_record.location, ''),
      NEW.open_positions,
      'open',
      NEW.last_updated_by,
      'Site: ' || site_record.site_name || ' | Site Code: ' || COALESCE(site_record.site_code, 'N/A')
    )
    RETURNING id INTO new_mandate_id;

    -- Link the mandate to this headcount agreement
    NEW.linked_mandate_id := new_mandate_id;
  
  -- If open_positions changed and mandate exists, update it
  ELSIF NEW.open_positions > 0 AND NEW.linked_mandate_id IS NOT NULL THEN
    UPDATE mandates
    SET number_of_positions = NEW.open_positions,
        updated_at = now()
    WHERE id = NEW.linked_mandate_id;
  
  -- If open_positions = 0 and mandate exists, close the mandate
  ELSIF NEW.open_positions = 0 AND NEW.linked_mandate_id IS NOT NULL THEN
    UPDATE mandates
    SET mandate_status = 'closed',
        closed_date = CURRENT_DATE,
        closure_reason = 'Headcount filled - no open positions',
        updated_at = now()
    WHERE id = NEW.linked_mandate_id;
  END IF;

  RETURN NEW;
END;
$$;

-- Create trigger for auto-mandate sync
CREATE TRIGGER sync_headcount_mandates_trigger
BEFORE INSERT OR UPDATE OF available_headcount, agreed_headcount ON public.site_headcount_agreements
FOR EACH ROW
EXECUTE FUNCTION public.sync_headcount_to_mandates();

-- Enable RLS on all new tables
ALTER TABLE public.sites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_coordinators ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_headcount_agreements ENABLE ROW LEVEL SECURITY;

-- RLS Policies for sites table
CREATE POLICY "Admins can manage all sites"
ON public.sites FOR ALL
USING (
  has_role(auth.uid(), 'admin'::app_role) OR
  has_role(auth.uid(), 'super_admin'::app_role) OR
  has_role(auth.uid(), 'platform_admin'::app_role)
);

CREATE POLICY "Coordinators can view their assigned sites"
ON public.sites FOR SELECT
USING (can_access_site(auth.uid(), id));

-- RLS Policies for site_coordinators table
CREATE POLICY "Admins can manage site coordinators"
ON public.site_coordinators FOR ALL
USING (
  has_role(auth.uid(), 'admin'::app_role) OR
  has_role(auth.uid(), 'super_admin'::app_role) OR
  has_role(auth.uid(), 'platform_admin'::app_role)
);

CREATE POLICY "Coordinators can view their assignments"
ON public.site_coordinators FOR SELECT
USING (user_id = auth.uid());

-- RLS Policies for site_headcount_agreements table
CREATE POLICY "Admins can manage all headcount agreements"
ON public.site_headcount_agreements FOR ALL
USING (
  has_role(auth.uid(), 'admin'::app_role) OR
  has_role(auth.uid(), 'super_admin'::app_role) OR
  has_role(auth.uid(), 'platform_admin'::app_role)
);

CREATE POLICY "Coordinators can view headcount for their sites"
ON public.site_headcount_agreements FOR SELECT
USING (can_access_site(auth.uid(), site_id));

CREATE POLICY "Coordinators can update available_headcount for their sites"
ON public.site_headcount_agreements FOR UPDATE
USING (can_access_site(auth.uid(), site_id))
WITH CHECK (can_access_site(auth.uid(), site_id));

-- Create indexes for performance
CREATE INDEX idx_sites_client_id ON public.sites(client_id);
CREATE INDEX idx_sites_is_active ON public.sites(is_active);
CREATE INDEX idx_site_coordinators_user_id ON public.site_coordinators(user_id);
CREATE INDEX idx_site_coordinators_site_id ON public.site_coordinators(site_id);
CREATE INDEX idx_site_headcount_site_id ON public.site_headcount_agreements(site_id);
CREATE INDEX idx_site_headcount_job_title ON public.site_headcount_agreements(job_title);

-- Update timestamps trigger for sites
CREATE TRIGGER update_sites_updated_at
BEFORE UPDATE ON public.sites
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();