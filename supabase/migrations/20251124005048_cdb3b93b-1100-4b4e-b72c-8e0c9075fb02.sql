-- Drop the old constraint that was using incorrect status values
ALTER TABLE mandates DROP CONSTRAINT IF EXISTS valid_status;

-- Add new constraint with correct status values matching the UI
ALTER TABLE mandates 
  ADD CONSTRAINT valid_mandate_status 
  CHECK (mandate_status = ANY (ARRAY[
    'open'::text,
    'closed'::text, 
    'on-hold'::text
  ]));