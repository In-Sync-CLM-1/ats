-- Fix search_path for trigger functions created in previous migration
ALTER FUNCTION trigger_auto_match_on_mandate_create() SET search_path = public;
ALTER FUNCTION trigger_rematch_on_master_update() SET search_path = public;
ALTER FUNCTION trigger_sync_on_mandate_close() SET search_path = public;