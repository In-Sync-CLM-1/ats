-- Backfill existing users without profiles
INSERT INTO public.profiles (id, email, full_name)
SELECT id, email, COALESCE(raw_user_meta_data->>'full_name', email) as full_name
FROM auth.users
WHERE id NOT IN (SELECT id FROM public.profiles);

-- Create missing trigger for automatic profile creation
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Trigger 1: Auto-match on mandate creation
CREATE OR REPLACE FUNCTION trigger_auto_match_on_mandate_create()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.mandate_status = 'open' THEN
    PERFORM net.http_post(
      url := current_setting('app.supabase_url', true) || '/functions/v1/ai-match-candidates',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.supabase_anon_key', true)
      ),
      body := jsonb_build_object(
        'mandateId', NEW.id,
        'triggerType', 'auto_create'
      )
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER mandate_created_auto_match
  AFTER INSERT ON mandates
  FOR EACH ROW
  EXECUTE FUNCTION trigger_auto_match_on_mandate_create();

-- Trigger 2: Re-match on master updates
CREATE OR REPLACE FUNCTION trigger_rematch_on_master_update()
RETURNS TRIGGER AS $$
BEGIN
  IF (OLD.key_skills IS DISTINCT FROM NEW.key_skills) OR
     (OLD.total_experience_years IS DISTINCT FROM NEW.total_experience_years) OR
     (OLD.designation IS DISTINCT FROM NEW.designation) OR
     (OLD.current_location IS DISTINCT FROM NEW.current_location) OR
     (OLD.preferred_location IS DISTINCT FROM NEW.preferred_location) OR
     (OLD.current_ctc_lakhs IS DISTINCT FROM NEW.current_ctc_lakhs) OR
     (OLD.expected_ctc_lakhs IS DISTINCT FROM NEW.expected_ctc_lakhs) OR
     (OLD.notice_period_days IS DISTINCT FROM NEW.notice_period_days) OR
     (OLD.highest_qualification IS DISTINCT FROM NEW.highest_qualification) THEN
    
    PERFORM net.http_post(
      url := current_setting('app.supabase_url', true) || '/functions/v1/ai-match-candidates',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.supabase_anon_key', true)
      ),
      body := jsonb_build_object(
        'candidateId', NEW.id,
        'triggerType', 'auto_update'
      )
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER master_updated_rematch
  AFTER UPDATE ON master
  FOR EACH ROW
  EXECUTE FUNCTION trigger_rematch_on_master_update();

-- Trigger 3: Sync on mandate close
CREATE OR REPLACE FUNCTION trigger_sync_on_mandate_close()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.mandate_status != 'closed' AND NEW.mandate_status = 'closed' THEN
    PERFORM net.http_post(
      url := current_setting('app.supabase_url', true) || '/functions/v1/sync-mandate-close',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.supabase_anon_key', true)
      ),
      body := jsonb_build_object(
        'mandateId', NEW.id
      )
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER mandate_closed_sync
  AFTER UPDATE ON mandates
  FOR EACH ROW
  EXECUTE FUNCTION trigger_sync_on_mandate_close();