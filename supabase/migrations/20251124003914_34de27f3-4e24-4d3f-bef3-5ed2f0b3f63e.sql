-- Fix the generate_mandate_id function to query from mandates instead of projects
CREATE OR REPLACE FUNCTION public.generate_mandate_id()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  next_number INTEGER;
  new_mandate_id TEXT;
BEGIN
  -- FIXED: Query from mandates table instead of projects
  SELECT COALESCE(MAX(CAST(REGEXP_REPLACE(mandate_id, '[^0-9]', '', 'g') AS INTEGER)), 0) + 1
  INTO next_number
  FROM mandates
  WHERE mandate_id IS NOT NULL 
    AND mandate_id ~ '^MND-\d+$';
  
  new_mandate_id := 'MND-' || LPAD(next_number::TEXT, 4, '0');
  RETURN new_mandate_id;
END;
$function$;