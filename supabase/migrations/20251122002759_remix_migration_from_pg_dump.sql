CREATE EXTENSION IF NOT EXISTS "pg_cron";
CREATE EXTENSION IF NOT EXISTS "pg_graphql";
CREATE EXTENSION IF NOT EXISTS "pg_net";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "plpgsql";
CREATE EXTENSION IF NOT EXISTS "supabase_vault";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
--
-- PostgreSQL database dump
--


-- Dumped from database version 17.6
-- Dumped by pg_dump version 17.7

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--



--
-- Name: app_role; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.app_role AS ENUM (
    'super_admin',
    'admin',
    'manager',
    'user',
    'client',
    'platform_admin',
    'admin_administration',
    'admin_tech',
    'agent',
    'csbd',
    'leadership'
);


--
-- Name: import_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.import_status AS ENUM (
    'pending',
    'processing',
    'completed',
    'failed',
    'cancelled'
);


--
-- Name: leave_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.leave_status AS ENUM (
    'pending',
    'approved',
    'rejected',
    'cancelled'
);


--
-- Name: leave_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.leave_type AS ENUM (
    'sick_leave',
    'casual_leave',
    'earned_leave',
    'unpaid_leave',
    'compensatory_off',
    'maternity_leave',
    'paternity_leave'
);


--
-- Name: onboarding_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.onboarding_status AS ENUM (
    'not_started',
    'in_progress',
    'completed',
    'skipped'
);


--
-- Name: priority_level; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.priority_level AS ENUM (
    'high',
    'medium',
    'low'
);


--
-- Name: recommendation_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.recommendation_status AS ENUM (
    'pending',
    'completed',
    'dismissed'
);


--
-- Name: recommendation_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.recommendation_type AS ENUM (
    'contact',
    'campaign',
    'follow_up',
    'placement',
    're_engage',
    'update_profile'
);


--
-- Name: tour_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.tour_type AS ENUM (
    'initial',
    'feature_update'
);


--
-- Name: calculate_attendance_hours(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.calculate_attendance_hours() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF NEW.sign_in_time IS NOT NULL AND NEW.sign_out_time IS NOT NULL THEN
    NEW.total_hours = EXTRACT(EPOCH FROM (NEW.sign_out_time - NEW.sign_in_time)) / 3600;
    
    IF NEW.total_hours >= 8 THEN
      NEW.status = 'present';
    ELSIF NEW.total_hours >= 4 THEN
      NEW.status = 'half_day';
    ELSE
      NEW.status = 'absent';
    END IF;
  END IF;
  
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


--
-- Name: calculate_distance(numeric, numeric, numeric, numeric); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.calculate_distance(lat1 numeric, lon1 numeric, lat2 numeric, lon2 numeric) RETURNS numeric
    LANGUAGE plpgsql IMMUTABLE
    SET search_path TO 'public'
    AS $$
DECLARE
  radius_earth NUMERIC := 3959; -- Earth's radius in miles
  dlat NUMERIC;
  dlon NUMERIC;
  a NUMERIC;
  c NUMERIC;
BEGIN
  -- Handle NULL values
  IF lat1 IS NULL OR lon1 IS NULL OR lat2 IS NULL OR lon2 IS NULL THEN
    RETURN NULL;
  END IF;
  
  dlat := radians(lat2 - lat1);
  dlon := radians(lon2 - lon1);
  
  a := sin(dlat/2) * sin(dlat/2) + 
       cos(radians(lat1)) * cos(radians(lat2)) * 
       sin(dlon/2) * sin(dlon/2);
  
  c := 2 * atan2(sqrt(a), sqrt(1-a));
  
  RETURN radius_earth * c;
END;
$$;


--
-- Name: can_access_project(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.can_access_project(_user_id uuid, _project_id uuid) RETURNS boolean
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  project_creator_id uuid;
BEGIN
  -- Get project creator directly (SECURITY DEFINER bypasses RLS)
  SELECT created_by INTO project_creator_id
  FROM projects
  WHERE id = _project_id;
  
  -- Check all access conditions
  RETURN (
    project_creator_id = _user_id
    OR
    public.is_project_team_member(_user_id, _project_id)
    OR
    public.has_role(_user_id, 'admin'::app_role)
    OR
    public.has_role(_user_id, 'super_admin'::app_role)
    OR
    public.has_role(_user_id, 'platform_admin'::app_role)
    OR
    public.has_role(_user_id, 'admin_tech'::app_role)
    OR
    public.has_role(_user_id, 'admin_administration'::app_role)
  );
END;
$$;


--
-- Name: can_access_user(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.can_access_user(_accessor_id uuid, _target_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT 
    -- User can access themselves
    _accessor_id = _target_id
    OR
    -- User can access direct reports (people who report to them)
    EXISTS (
      SELECT 1 
      FROM public.profiles 
      WHERE id = _target_id 
      AND reports_to = _accessor_id
    )
    OR
    -- User can access indirect reports (reports of reports, recursively)
    EXISTS (
      WITH RECURSIVE reporting_chain AS (
        -- Start with direct reports
        SELECT id, reports_to
        FROM public.profiles
        WHERE reports_to = _accessor_id
        
        UNION ALL
        
        -- Recursively get reports of reports
        SELECT p.id, p.reports_to
        FROM public.profiles p
        INNER JOIN reporting_chain rc ON p.reports_to = rc.id
      )
      SELECT 1
      FROM reporting_chain
      WHERE id = _target_id
    )
    OR
    -- FIXED: User can access those with LOWER designation level ONLY (changed from >= to >)
    -- This prevents agents from seeing other agents' data
    public.get_user_designation_level(_accessor_id) > public.get_user_designation_level(_target_id)
    OR
    -- All admin roles can access everyone
    public.has_role(_accessor_id, 'platform_admin'::app_role)
    OR
    public.has_role(_accessor_id, 'super_admin'::app_role)
    OR
    public.has_role(_accessor_id, 'admin'::app_role)
    OR
    public.has_role(_accessor_id, 'admin_administration'::app_role)
    OR
    public.has_role(_accessor_id, 'admin_tech'::app_role)
$$;


--
-- Name: check_webhook_rate_limit(uuid, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.check_webhook_rate_limit(_webhook_id uuid, _limit integer) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  request_count integer;
BEGIN
  -- Count requests in the last minute for this webhook
  SELECT COUNT(*)
  INTO request_count
  FROM public.webhook_logs
  WHERE webhook_connector_id = _webhook_id
    AND created_at > NOW() - INTERVAL '1 minute';
  
  RETURN request_count < _limit;
END;
$$;


--
-- Name: generate_project_number(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.generate_project_number() RETURNS text
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $_$
DECLARE
  next_number INTEGER;
  new_project_number TEXT;
BEGIN
  -- Get the highest existing project number
  -- Extract numeric part from project numbers like "PRJ-0001"
  SELECT COALESCE(MAX(CAST(REGEXP_REPLACE(project_number, '[^0-9]', '', 'g') AS INTEGER)), 0) + 1
  INTO next_number
  FROM projects
  WHERE project_number IS NOT NULL 
    AND project_number ~ '^PRJ-\d+$';
  
  -- Generate new project number with leading zeros (e.g., PRJ-0002)
  new_project_number := 'PRJ-' || LPAD(next_number::TEXT, 4, '0');
  
  RETURN new_project_number;
END;
$_$;


--
-- Name: get_daily_record_counts(integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_daily_record_counts(days integer) RETURNS TABLE(date date, created_count bigint, updated_count bigint)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  RETURN QUERY
  WITH date_series AS (
    SELECT generate_series(
      CURRENT_DATE - days,
      CURRENT_DATE,
      '1 day'::interval
    )::date AS date
  ),
  created_records AS (
    SELECT 
      DATE(created_at) AS date,
      COUNT(*) AS count
    FROM (
      SELECT created_at FROM master
      UNION ALL
      SELECT created_at FROM demandcom
    ) combined
    WHERE DATE(created_at) >= CURRENT_DATE - days
    GROUP BY DATE(created_at)
  ),
  updated_records AS (
    SELECT 
      DATE(updated_at) AS date,
      COUNT(*) AS count
    FROM (
      SELECT created_at, updated_at FROM master
      WHERE EXTRACT(EPOCH FROM (updated_at - created_at)) > 60
      UNION ALL
      SELECT created_at, updated_at FROM demandcom
      WHERE EXTRACT(EPOCH FROM (updated_at - created_at)) > 60
    ) combined
    WHERE DATE(updated_at) >= CURRENT_DATE - days
    GROUP BY DATE(updated_at)
  )
  SELECT 
    ds.date,
    COALESCE(cr.count, 0) AS created_count,
    COALESCE(ur.count, 0) AS updated_count
  FROM date_series ds
  LEFT JOIN created_records cr ON ds.date = cr.date
  LEFT JOIN updated_records ur ON ds.date = ur.date
  ORDER BY ds.date;
END;
$$;


--
-- Name: get_project_creator_name(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_project_creator_name(_user_id uuid) RETURNS text
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT full_name FROM profiles WHERE id = _user_id;
$$;


--
-- Name: get_user_designation_level(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_user_designation_level(_user_id uuid) RETURNS integer
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT COALESCE(MAX(d.level), 0)
  FROM public.user_designations ud
  JOIN public.designations d ON d.id = ud.designation_id
  WHERE ud.user_id = _user_id
    AND ud.is_current = true
    AND d.is_active = true
$$;


--
-- Name: handle_new_user(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_new_user() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  -- Insert profile
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'full_name'
  );
  
  -- Assign default 'agent' role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'agent');
  
  RETURN NEW;
END;
$$;


--
-- Name: has_role(uuid, public.app_role); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.has_role(_user_id uuid, _role public.app_role) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;


--
-- Name: initialize_leave_balance(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.initialize_leave_balance() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  INSERT INTO public.leave_balances (user_id, year)
  VALUES (NEW.id, EXTRACT(YEAR FROM CURRENT_DATE))
  ON CONFLICT (user_id, year) DO NOTHING;
  
  RETURN NEW;
END;
$$;


--
-- Name: is_project_team_member(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_project_team_member(_user_id uuid, _project_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM project_team_members
    WHERE project_id = _project_id
    AND user_id = _user_id
  )
$$;


--
-- Name: log_allocation_audit(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.log_allocation_audit() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO inventory_audit_log (
      inventory_item_id, allocation_id, action, user_id, notes, changed_by
    ) VALUES (
      NEW.inventory_item_id, NEW.id, 'allocated', NEW.user_id, NEW.allocation_notes, NEW.allocated_by
    );
    
    UPDATE inventory_items
    SET status = 'Allocated'
    WHERE id = NEW.inventory_item_id;
    
  ELSIF TG_OP = 'UPDATE' AND NEW.status = 'returned' AND OLD.status = 'active' THEN
    INSERT INTO inventory_audit_log (
      inventory_item_id, allocation_id, action, user_id, notes, changed_by
    ) VALUES (
      NEW.inventory_item_id, NEW.id, 'deallocated', NEW.user_id, NEW.return_notes, NEW.deallocated_by
    );
    
    UPDATE inventory_items
    SET 
      status = CASE 
        WHEN NEW.returned_condition = 'Good' THEN 'Available'
        WHEN NEW.returned_condition = 'Needs Repair' THEN 'Damaged'
        WHEN NEW.returned_condition = 'Damaged' THEN 'Retired'
      END,
      current_condition = NEW.returned_condition
    WHERE id = NEW.inventory_item_id;
  END IF;
  
  RETURN NEW;
END;
$$;


--
-- Name: log_csbd_projection_change(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.log_csbd_projection_change() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF (TG_OP = 'INSERT') THEN
    INSERT INTO csbd_projection_audit (projection_id, user_id, action, new_value, changed_by)
    VALUES (NEW.id, NEW.user_id, 'created', NEW.projection_amount_inr_lacs, auth.uid());
    RETURN NEW;
  ELSIF (TG_OP = 'UPDATE') THEN
    IF (OLD.projection_amount_inr_lacs != NEW.projection_amount_inr_lacs) THEN
      INSERT INTO csbd_projection_audit (projection_id, user_id, action, old_value, new_value, changed_by)
      VALUES (NEW.id, NEW.user_id, 'updated', OLD.projection_amount_inr_lacs, NEW.projection_amount_inr_lacs, auth.uid());
    END IF;
    RETURN NEW;
  ELSIF (TG_OP = 'DELETE') THEN
    INSERT INTO csbd_projection_audit (projection_id, user_id, action, old_value, changed_by)
    VALUES (OLD.id, OLD.user_id, 'deleted', OLD.projection_amount_inr_lacs, auth.uid());
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;


--
-- Name: log_inventory_audit(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.log_inventory_audit() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF OLD.status IS DISTINCT FROM NEW.status THEN
      INSERT INTO inventory_audit_log (
        inventory_item_id, action, old_status, new_status, changed_by
      ) VALUES (
        NEW.id, 'status_changed', OLD.status, NEW.status, auth.uid()
      );
    END IF;
    
    IF OLD.current_condition IS DISTINCT FROM NEW.current_condition THEN
      INSERT INTO inventory_audit_log (
        inventory_item_id, action, old_condition, new_condition, changed_by
      ) VALUES (
        NEW.id, 'condition_changed', OLD.current_condition, NEW.current_condition, auth.uid()
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;


--
-- Name: notify_general_task_assignment(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.notify_general_task_assignment() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  IF (TG_OP = 'INSERT') OR (OLD.assigned_to IS DISTINCT FROM NEW.assigned_to) THEN
    IF NEW.assigned_to IS NOT NULL AND NEW.assigned_to != NEW.assigned_by THEN
      INSERT INTO public.notifications (
        user_id,
        general_task_id,
        notification_type,
        title,
        message
      ) VALUES (
        NEW.assigned_to,
        NEW.id,
        'task_assigned',
        'New Task Assigned',
        'You have been assigned a new task: ' || NEW.task_name
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: notify_task_assignment(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.notify_task_assignment() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  -- Only notify on INSERT or when assigned_to changes
  IF (TG_OP = 'INSERT') OR (OLD.assigned_to IS DISTINCT FROM NEW.assigned_to) THEN
    -- Don't notify if user assigns task to themselves
    IF NEW.assigned_to IS NOT NULL AND NEW.assigned_to != NEW.assigned_by THEN
      INSERT INTO public.notifications (
        user_id,
        task_id,
        notification_type,
        title,
        message
      ) VALUES (
        NEW.assigned_to,
        NEW.id,
        'task_assigned',
        'New Task Assigned',
        'You have been assigned a new task: ' || NEW.task_name
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: send_task_assignment_email(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.send_task_assignment_email() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  task_data RECORD;
  assigned_user_data RECORD;
  assigned_by_data RECORD;
  supabase_url TEXT := 'https://xbrinligpvtfpqkkllfl.supabase.co';
  supabase_anon_key TEXT := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhicmlubGlncHZ0ZnBxa2tsbGZsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAxNDM4MTIsImV4cCI6MjA3NTcxOTgxMn0.qQriBXjWb5AIc0h4rBxnkpI2J2tbfj9TGsXOPse_Bnc';
BEGIN
  -- Only send email on INSERT or when assigned_to changes
  IF (TG_OP = 'INSERT') OR (OLD.assigned_to IS DISTINCT FROM NEW.assigned_to) THEN
    -- Don't send email if user assigns task to themselves
    IF NEW.assigned_to IS NOT NULL AND NEW.assigned_to != NEW.assigned_by THEN
      
      -- Get task details
      SELECT * INTO task_data FROM project_tasks WHERE id = NEW.id;
      
      -- Get assigned user email
      SELECT email, full_name INTO assigned_user_data 
      FROM profiles WHERE id = NEW.assigned_to;
      
      -- Get assigned by user name
      SELECT full_name INTO assigned_by_data 
      FROM profiles WHERE id = NEW.assigned_by;
      
      IF assigned_user_data.email IS NOT NULL THEN
        -- Call edge function to send email using pg_net
        PERFORM net.http_post(
          url := supabase_url || '/functions/v1/send-task-notification-email',
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || supabase_anon_key
          ),
          body := jsonb_build_object(
            'user_id', NEW.assigned_to,
            'task_id', NEW.id,
            'notification_type', 'task_assigned',
            'task_name', task_data.task_name,
            'due_date', task_data.due_date,
            'assigned_by_name', assigned_by_data.full_name
          )
        );
      END IF;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;


--
-- Name: update_demandcom_latest_disposition(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_demandcom_latest_disposition() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  -- Only update if disposition was set AND is not an empty string
  IF NEW.disposition IS NOT NULL AND NEW.disposition != '' THEN
    UPDATE demandcom
    SET 
      latest_disposition = NEW.disposition,
      latest_subdisposition = NEW.subdisposition,
      last_call_date = NEW.disposition_set_at
    WHERE id = NEW.demandcom_id;
  END IF;
  
  RETURN NEW;
END;
$$;


--
-- Name: update_general_tasks_completed_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_general_tasks_completed_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = NOW();
  IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
    NEW.completed_at = NOW();
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: update_leave_balance(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_leave_balance() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  -- When leave is approved, deduct from balance
  IF NEW.status = 'approved' AND OLD.status = 'pending' THEN
    UPDATE public.leave_balances
    SET 
      sick_leave_balance = CASE 
        WHEN NEW.leave_type = 'sick_leave' THEN sick_leave_balance - NEW.total_days
        ELSE sick_leave_balance
      END,
      casual_leave_balance = CASE 
        WHEN NEW.leave_type = 'casual_leave' THEN casual_leave_balance - NEW.total_days
        ELSE casual_leave_balance
      END,
      earned_leave_balance = CASE 
        WHEN NEW.leave_type = 'earned_leave' THEN earned_leave_balance - NEW.total_days
        ELSE earned_leave_balance
      END,
      compensatory_off_balance = CASE 
        WHEN NEW.leave_type = 'compensatory_off' THEN compensatory_off_balance - NEW.total_days
        ELSE compensatory_off_balance
      END,
      updated_at = NOW()
    WHERE user_id = NEW.user_id 
      AND year = EXTRACT(YEAR FROM NEW.start_date);
  END IF;
  
  -- When leave is cancelled or rejected, add back to balance
  IF (NEW.status = 'cancelled' OR NEW.status = 'rejected') AND OLD.status = 'approved' THEN
    UPDATE public.leave_balances
    SET 
      sick_leave_balance = CASE 
        WHEN NEW.leave_type = 'sick_leave' THEN sick_leave_balance + NEW.total_days
        ELSE sick_leave_balance
      END,
      casual_leave_balance = CASE 
        WHEN NEW.leave_type = 'casual_leave' THEN casual_leave_balance + NEW.total_days
        ELSE casual_leave_balance
      END,
      earned_leave_balance = CASE 
        WHEN NEW.leave_type = 'earned_leave' THEN earned_leave_balance + NEW.total_days
        ELSE earned_leave_balance
      END,
      compensatory_off_balance = CASE 
        WHEN NEW.leave_type = 'compensatory_off' THEN compensatory_off_balance + NEW.total_days
        ELSE compensatory_off_balance
      END,
      updated_at = NOW()
    WHERE user_id = NEW.user_id 
      AND year = EXTRACT(YEAR FROM NEW.start_date);
  END IF;
  
  RETURN NEW;
END;
$$;


--
-- Name: update_project_tasks_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_project_tasks_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = NOW();
  IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
    NEW.completed_at = NOW();
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


SET default_table_access_method = heap;

--
-- Name: attendance_policies; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.attendance_policies (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    policy_name text NOT NULL,
    working_hours_per_day numeric(3,1) DEFAULT 8,
    grace_period_minutes integer DEFAULT 15,
    half_day_threshold_hours numeric(3,1) DEFAULT 4,
    overtime_start_after_hours numeric(3,1) DEFAULT 8,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: attendance_records; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.attendance_records (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    date date NOT NULL,
    sign_in_time timestamp with time zone,
    sign_out_time timestamp with time zone,
    total_hours numeric(5,2),
    status text DEFAULT 'present'::text NOT NULL,
    location_lat numeric(10,7),
    location_lng numeric(10,7),
    sign_in_device_info jsonb,
    sign_out_device_info jsonb,
    notes text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    sign_in_photo_url text,
    sign_out_photo_url text,
    sign_in_location_accuracy numeric,
    sign_out_location_accuracy numeric,
    sign_in_location_city text,
    sign_in_location_state text,
    sign_out_location_city text,
    sign_out_location_state text,
    network_status text,
    sync_status text DEFAULT 'synced'::text
);


--
-- Name: bulk_import_history; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bulk_import_history (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    table_name text NOT NULL,
    status public.import_status DEFAULT 'pending'::public.import_status NOT NULL,
    total_records integer NOT NULL,
    processed_records integer DEFAULT 0,
    successful_records integer DEFAULT 0,
    failed_records integer DEFAULT 0,
    current_batch integer DEFAULT 0,
    total_batches integer NOT NULL,
    file_name text NOT NULL,
    error_log jsonb DEFAULT '[]'::jsonb,
    can_revert boolean DEFAULT true,
    reverted_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    completed_at timestamp with time zone,
    cancelled_at timestamp with time zone
);


--
-- Name: bulk_import_records; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bulk_import_records (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    import_id uuid NOT NULL,
    record_id uuid NOT NULL,
    table_name text NOT NULL,
    row_number integer NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: call_dispositions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.call_dispositions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    disposition text NOT NULL,
    subdispositions text[] DEFAULT '{}'::text[] NOT NULL,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: call_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.call_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    call_sid text NOT NULL,
    demandcom_id uuid,
    initiated_by uuid,
    from_number text NOT NULL,
    to_number text NOT NULL,
    status text DEFAULT 'initiated'::text NOT NULL,
    direction text DEFAULT 'outbound-api'::text,
    conversation_duration integer DEFAULT 0,
    recording_url text,
    start_time timestamp with time zone,
    end_time timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    exotel_response jsonb DEFAULT '{}'::jsonb,
    disposition text,
    subdisposition text,
    notes text,
    disposition_set_by uuid,
    disposition_set_at timestamp with time zone,
    call_method text DEFAULT 'phone'::text,
    edited_contact_info jsonb DEFAULT '{}'::jsonb,
    CONSTRAINT call_logs_call_method_check CHECK ((call_method = ANY (ARRAY['phone'::text, 'screen'::text]))),
    CONSTRAINT call_logs_status_check CHECK ((status = ANY (ARRAY['initiated'::text, 'ringing'::text, 'in-progress'::text, 'completed'::text, 'no-answer'::text, 'busy'::text, 'failed'::text, 'canceled'::text])))
);


--
-- Name: campaign_links; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.campaign_links (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    campaign_id uuid NOT NULL,
    original_url text NOT NULL,
    short_code text NOT NULL,
    click_count integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: campaign_recipients; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.campaign_recipients (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    campaign_id uuid NOT NULL,
    demandcom_id uuid,
    status text DEFAULT 'pending'::text NOT NULL,
    sent_at timestamp with time zone,
    delivered_at timestamp with time zone,
    opened_at timestamp with time zone,
    clicked_at timestamp with time zone,
    error_message text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT campaign_recipients_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'sent'::text, 'delivered'::text, 'opened'::text, 'clicked'::text, 'bounced'::text, 'unsubscribed'::text, 'failed'::text])))
);


--
-- Name: campaigns; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.campaigns (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    type text NOT NULL,
    status text DEFAULT 'draft'::text NOT NULL,
    template_id uuid,
    subject text,
    scheduled_at timestamp with time zone,
    sent_at timestamp with time zone,
    total_recipients integer DEFAULT 0,
    sent_count integer DEFAULT 0,
    delivered_count integer DEFAULT 0,
    opened_count integer DEFAULT 0,
    clicked_count integer DEFAULT 0,
    bounced_count integer DEFAULT 0,
    unsubscribed_count integer DEFAULT 0,
    filter_criteria jsonb,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    audience_data jsonb,
    emails_per_minute integer DEFAULT 20,
    delay_between_emails_ms integer DEFAULT 3000,
    CONSTRAINT campaigns_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'scheduled'::text, 'sending'::text, 'sent'::text, 'paused'::text, 'cancelled'::text]))),
    CONSTRAINT campaigns_type_check CHECK ((type = ANY (ARRAY['email'::text, 'sms'::text])))
);


--
-- Name: clients; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.clients (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    company_name text NOT NULL,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    contact_name text NOT NULL,
    official_address text,
    residence_address text,
    contact_number text,
    email_id text,
    birthday_date date,
    anniversary_date date,
    company_linkedin_page text,
    linkedin_id text
);


--
-- Name: projects; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.projects (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    project_name text NOT NULL,
    brief text,
    client_id text,
    locations jsonb DEFAULT '[]'::jsonb,
    status text DEFAULT 'new'::text NOT NULL,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    event_dates jsonb DEFAULT '[]'::jsonb,
    contact_id text,
    project_source text,
    project_value numeric,
    management_fees numeric,
    expected_afactor numeric,
    final_afactor numeric,
    project_number text,
    closed_reason text,
    lost_reason text,
    CONSTRAINT valid_status CHECK ((status = ANY (ARRAY['pitched'::text, 'in_discussion'::text, 'estimate_shared'::text, 'po_received'::text, 'execution'::text, 'invoiced'::text, 'closed'::text, 'lost'::text])))
);


--
-- Name: csbd_actuals; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.csbd_actuals AS
 SELECT created_by AS user_id,
    date_trunc('month'::text, updated_at) AS month,
    sum(COALESCE(final_afactor, expected_afactor, (0)::numeric)) AS actual_amount_inr_lacs,
    count(*) AS deals_closed,
    array_agg(project_number ORDER BY updated_at DESC) AS project_numbers
   FROM public.projects
  WHERE ((status = 'invoiced'::text) AND ((final_afactor IS NOT NULL) OR (expected_afactor IS NOT NULL)))
  GROUP BY created_by, (date_trunc('month'::text, updated_at));


--
-- Name: csbd_projection_audit; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.csbd_projection_audit (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    projection_id uuid NOT NULL,
    user_id uuid NOT NULL,
    action text NOT NULL,
    old_value numeric(10,2),
    new_value numeric(10,2),
    changed_by uuid,
    changed_at timestamp with time zone DEFAULT now(),
    ip_address text,
    user_agent text
);


--
-- Name: csbd_projections; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.csbd_projections (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    month date NOT NULL,
    projection_amount_inr_lacs numeric(10,2) NOT NULL,
    notes text,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT csbd_projections_month_check CHECK ((EXTRACT(day FROM month) = (1)::numeric)),
    CONSTRAINT csbd_projections_projection_amount_inr_lacs_check CHECK ((projection_amount_inr_lacs >= (0)::numeric))
);


--
-- Name: csbd_targets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.csbd_targets (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    fiscal_year integer NOT NULL,
    annual_target_inr_lacs numeric(10,2) NOT NULL,
    has_subordinates boolean DEFAULT false,
    is_active boolean DEFAULT true,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT csbd_targets_annual_target_inr_lacs_check CHECK ((annual_target_inr_lacs > (0)::numeric)),
    CONSTRAINT csbd_targets_fiscal_year_check CHECK (((fiscal_year >= 2020) AND (fiscal_year <= 2100)))
);


--
-- Name: demandcom; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.demandcom (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    city text,
    state text,
    pincode text,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    designation text,
    deppt text,
    job_level_updated text,
    mobile2 text,
    official text,
    personal_email_id text,
    generic_email_id text,
    industry_type text,
    sub_industry text,
    company_name text,
    address text,
    location text,
    zone text,
    tier text,
    website text,
    turnover text,
    emp_size text,
    erp_name text,
    erp_vendor text,
    name text,
    mobile_numb text,
    linkedin text,
    activity_name text,
    latest_disposition text,
    latest_subdisposition text,
    last_call_date timestamp with time zone,
    assigned_to uuid,
    assigned_by uuid,
    assigned_at timestamp with time zone,
    assignment_status text DEFAULT 'unassigned'::text,
    next_call_date timestamp with time zone,
    country text,
    source text,
    source_1 text,
    extra text,
    extra_1 text,
    extra_2 text,
    user_id text,
    salutation text,
    turnover_link text,
    company_linkedin_url text,
    associated_member_linkedin text,
    remarks text
);


--
-- Name: demandcom_backup_swap_20250129; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.demandcom_backup_swap_20250129 (
    id uuid,
    city text,
    state text,
    pincode text,
    created_by uuid,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    designation text,
    deppt text,
    job_level_updated text,
    mobile2 text,
    official text,
    personal_email_id text,
    generic_email_id text,
    industry_type text,
    sub_industry text,
    company_name text,
    address text,
    location text,
    zone text,
    tier text,
    website text,
    turnover text,
    emp_size text,
    erp_name text,
    erp_vendor text,
    name text,
    mobile_numb text,
    linkedin text,
    activity_name text,
    latest_disposition text,
    latest_subdisposition text,
    last_call_date timestamp with time zone
);


--
-- Name: demandcom_pipeline; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.demandcom_pipeline (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    demandcom_id uuid NOT NULL,
    stage_id uuid NOT NULL,
    entered_at timestamp with time zone DEFAULT now() NOT NULL,
    exited_at timestamp with time zone,
    notes text,
    moved_by uuid,
    is_current boolean DEFAULT true
);


--
-- Name: designations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.designations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    title text NOT NULL,
    description text,
    level integer,
    department text,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: email_templates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.email_templates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    subject text NOT NULL,
    body_html text NOT NULL,
    body_text text,
    category text,
    is_active boolean DEFAULT true NOT NULL,
    version integer DEFAULT 1 NOT NULL,
    merge_tags text[],
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    image_url text,
    button_text text,
    button_url text,
    facebook_url text,
    twitter_url text,
    linkedin_url text,
    instagram_url text
);


--
-- Name: export_jobs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.export_jobs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    source text NOT NULL,
    filters jsonb,
    status text DEFAULT 'pending'::text NOT NULL,
    total_records integer,
    processed_records integer DEFAULT 0,
    file_url text,
    error_message text,
    created_at timestamp with time zone DEFAULT now(),
    started_at timestamp with time zone,
    completed_at timestamp with time zone,
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: feature_announcements; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.feature_announcements (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    title text NOT NULL,
    description text NOT NULL,
    announcement_type text NOT NULL,
    priority text DEFAULT 'medium'::text NOT NULL,
    target_roles text[],
    image_url text,
    link_url text,
    link_text text,
    is_active boolean DEFAULT true,
    published_at timestamp with time zone DEFAULT now(),
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT feature_announcements_announcement_type_check CHECK ((announcement_type = ANY (ARRAY['new_feature'::text, 'update'::text, 'bug_fix'::text, 'removal'::text, 'improvement'::text]))),
    CONSTRAINT feature_announcements_priority_check CHECK ((priority = ANY (ARRAY['low'::text, 'medium'::text, 'high'::text, 'critical'::text])))
);


--
-- Name: general_tasks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.general_tasks (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    task_name text NOT NULL,
    description text,
    assigned_to uuid NOT NULL,
    assigned_by uuid NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    priority text DEFAULT 'medium'::text,
    due_date timestamp with time zone NOT NULL,
    completed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT general_tasks_priority_check CHECK ((priority = ANY (ARRAY['low'::text, 'medium'::text, 'high'::text, 'urgent'::text]))),
    CONSTRAINT general_tasks_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'in_progress'::text, 'completed'::text, 'cancelled'::text])))
);


--
-- Name: inbound_sms; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.inbound_sms (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    from_number text NOT NULL,
    to_number text NOT NULL,
    message_text text NOT NULL,
    message_uuid text,
    campaign_id uuid,
    demandcom_id uuid,
    is_opt_out boolean DEFAULT false,
    received_at timestamp with time zone DEFAULT now(),
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: inventory_allocations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.inventory_allocations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    inventory_item_id uuid NOT NULL,
    user_id uuid NOT NULL,
    allocation_date timestamp with time zone DEFAULT now() NOT NULL,
    allocated_condition text NOT NULL,
    expected_return_date date,
    allocation_notes text,
    allocated_by uuid,
    deallocation_date timestamp with time zone,
    returned_condition text,
    return_notes text,
    deallocated_by uuid,
    status text DEFAULT 'active'::text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT inventory_allocations_allocated_condition_check CHECK ((allocated_condition = ANY (ARRAY['New'::text, 'Good'::text, 'Used'::text]))),
    CONSTRAINT inventory_allocations_returned_condition_check CHECK ((returned_condition = ANY (ARRAY['Good'::text, 'Needs Repair'::text, 'Damaged'::text]))),
    CONSTRAINT inventory_allocations_status_check CHECK ((status = ANY (ARRAY['active'::text, 'returned'::text])))
);


--
-- Name: inventory_audit_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.inventory_audit_log (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    inventory_item_id uuid NOT NULL,
    allocation_id uuid,
    action text NOT NULL,
    old_status text,
    new_status text,
    old_condition text,
    new_condition text,
    user_id uuid,
    notes text,
    changed_by uuid,
    "timestamp" timestamp with time zone DEFAULT now(),
    CONSTRAINT inventory_audit_log_action_check CHECK ((action = ANY (ARRAY['allocated'::text, 'deallocated'::text, 'status_changed'::text, 'condition_changed'::text, 'repaired'::text])))
);


--
-- Name: inventory_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.inventory_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    invoice_no text NOT NULL,
    date_of_purchase date NOT NULL,
    vendor_name text NOT NULL,
    vendor_id uuid,
    invoice_date date NOT NULL,
    items text NOT NULL,
    brand text,
    model text,
    item_description text,
    quantity numeric NOT NULL,
    rate numeric(10,2) NOT NULL,
    units text NOT NULL,
    total_price numeric(10,2) GENERATED ALWAYS AS ((quantity * rate)) STORED,
    gst_slab numeric(5,2) DEFAULT 18.00 NOT NULL,
    gst_amount numeric(10,2) GENERATED ALWAYS AS ((((quantity * rate) * gst_slab) / (100)::numeric)) STORED,
    total_cost numeric(10,2) GENERATED ALWAYS AS (((quantity * rate) * ((1)::numeric + (gst_slab / (100)::numeric)))) STORED,
    invoice_file_url text,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    serial_number text,
    imei text,
    status text DEFAULT 'Available'::text,
    current_condition text DEFAULT 'New'::text,
    CONSTRAINT inventory_items_current_condition_check CHECK ((current_condition = ANY (ARRAY['New'::text, 'Good'::text, 'Used'::text, 'Needs Repair'::text, 'Damaged'::text]))),
    CONSTRAINT inventory_items_gst_slab_check CHECK ((gst_slab = ANY (ARRAY[(0)::numeric, (5)::numeric, (12)::numeric, (18)::numeric, (28)::numeric, (40)::numeric]))),
    CONSTRAINT inventory_items_quantity_check CHECK ((quantity >= (1)::numeric)),
    CONSTRAINT inventory_items_rate_check CHECK ((rate >= (0)::numeric)),
    CONSTRAINT inventory_items_status_check CHECK ((status = ANY (ARRAY['Available'::text, 'Allocated'::text, 'Damaged'::text, 'Retired'::text])))
);


--
-- Name: inventory_summary_stats; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.inventory_summary_stats AS
 SELECT count(*) AS total_inventory,
    count(*) FILTER (WHERE (status = 'Available'::text)) AS available_count,
    count(*) FILTER (WHERE (status = 'Allocated'::text)) AS allocated_count,
    count(*) FILTER (WHERE (status = 'Damaged'::text)) AS damaged_count,
    count(*) FILTER (WHERE (status = 'Retired'::text)) AS retired_count
   FROM public.inventory_items;


--
-- Name: jobs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.jobs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    client_id text,
    title text NOT NULL,
    description text,
    specialty text,
    license_required text,
    location_city text,
    location_state text,
    location_zip text,
    latitude numeric(10,8),
    longitude numeric(11,8),
    salary_min numeric(10,2),
    salary_max numeric(10,2),
    status text DEFAULT 'open'::text NOT NULL,
    excelhire_id text,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: leave_applications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.leave_applications (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    leave_type public.leave_type NOT NULL,
    start_date date NOT NULL,
    end_date date NOT NULL,
    total_days numeric(3,1) NOT NULL,
    reason text NOT NULL,
    status public.leave_status DEFAULT 'pending'::public.leave_status NOT NULL,
    applied_at timestamp with time zone DEFAULT now(),
    approved_by uuid,
    approved_at timestamp with time zone,
    rejection_reason text,
    attachments jsonb,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: leave_balances; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.leave_balances (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    year integer NOT NULL,
    sick_leave_balance numeric(4,1) DEFAULT 12,
    casual_leave_balance numeric(4,1) DEFAULT 12,
    earned_leave_balance numeric(4,1) DEFAULT 15,
    compensatory_off_balance numeric(4,1) DEFAULT 0,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: master; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.master (
    mobile_numb text NOT NULL,
    name text NOT NULL,
    designation text,
    deppt text,
    job_level_updated text,
    linkedin text,
    mobile2 text,
    official text,
    personal_email_id text,
    generic_email_id text,
    industry_type text,
    sub_industry text,
    company_name text,
    address text,
    location text,
    city text,
    state text,
    zone text,
    tier text,
    pincode text,
    website text,
    turnover text,
    emp_size text,
    erp_name text,
    erp_vendor text,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    id uuid DEFAULT gen_random_uuid(),
    assigned_to uuid,
    assigned_by uuid,
    assigned_at timestamp with time zone,
    assignment_status text DEFAULT 'unassigned'::text,
    last_call_date timestamp with time zone,
    next_call_date timestamp with time zone,
    latest_disposition text,
    latest_subdisposition text,
    activity_name text,
    country text,
    source text,
    source_1 text,
    extra text,
    extra_1 text,
    extra_2 text,
    user_id text,
    salutation text,
    turnover_link text,
    company_linkedin_url text,
    associated_member_linkedin text
);


--
-- Name: notifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notifications (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    task_id uuid,
    notification_type text NOT NULL,
    title text NOT NULL,
    message text NOT NULL,
    is_read boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now(),
    read_at timestamp with time zone,
    general_task_id uuid,
    CONSTRAINT notifications_notification_type_check CHECK ((notification_type = ANY (ARRAY['task_assigned'::text, 'due_soon'::text, 'overdue'::text])))
);


--
-- Name: onboarding_steps; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.onboarding_steps (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tour_id uuid NOT NULL,
    step_order integer NOT NULL,
    title text NOT NULL,
    content text NOT NULL,
    target_element text,
    target_route text,
    image_url text,
    action_label text DEFAULT 'Next'::text,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: onboarding_tours; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.onboarding_tours (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    title text NOT NULL,
    description text,
    version integer NOT NULL,
    tour_type public.tour_type NOT NULL,
    target_roles text[],
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: password_reset_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.password_reset_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    admin_user_id uuid NOT NULL,
    target_user_id uuid NOT NULL,
    admin_email text NOT NULL,
    target_email text NOT NULL,
    admin_full_name text,
    target_full_name text,
    action_status text NOT NULL,
    failure_reason text,
    ip_address text,
    user_agent text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT password_reset_logs_action_status_check CHECK ((action_status = ANY (ARRAY['success'::text, 'failed'::text])))
);


--
-- Name: pipeline_stages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pipeline_stages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    description text,
    stage_order integer NOT NULL,
    stage_type text DEFAULT 'candidate'::text NOT NULL,
    color text DEFAULT '#3b82f6'::text,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.profiles (
    id uuid NOT NULL,
    email text NOT NULL,
    full_name text,
    avatar_url text,
    phone text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    reports_to uuid,
    onboarding_completed boolean DEFAULT false,
    onboarding_skipped boolean DEFAULT false,
    last_tour_version_seen integer DEFAULT 0
);


--
-- Name: project_demandcom_checklist; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.project_demandcom_checklist (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    project_id uuid NOT NULL,
    checklist_item text NOT NULL,
    description text,
    assigned_to uuid,
    due_date date,
    status text DEFAULT 'pending'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT project_demandcom_checklist_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'in_progress'::text, 'completed'::text])))
);


--
-- Name: project_digicom_checklist; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.project_digicom_checklist (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    project_id uuid NOT NULL,
    checklist_item text NOT NULL,
    assigned_to uuid,
    due_date date,
    status text DEFAULT 'pending'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT project_digicom_checklist_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'in_progress'::text, 'completed'::text])))
);


--
-- Name: project_files; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.project_files (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    project_id uuid NOT NULL,
    file_name text NOT NULL,
    file_path text NOT NULL,
    file_type text DEFAULT 'other'::text NOT NULL,
    uploaded_by uuid,
    uploaded_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT valid_file_type CHECK ((file_type = ANY (ARRAY['brief'::text, 'quotation'::text, 'other'::text])))
);


--
-- Name: project_livecom_checklist; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.project_livecom_checklist (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    project_id uuid NOT NULL,
    checklist_item text NOT NULL,
    assigned_to uuid,
    due_date date,
    status text DEFAULT 'pending'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT project_livecom_checklist_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'in_progress'::text, 'completed'::text])))
);


--
-- Name: project_quotations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.project_quotations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    project_id uuid NOT NULL,
    quotation_number text NOT NULL,
    amount numeric(12,2),
    currency text DEFAULT 'USD'::text NOT NULL,
    status text DEFAULT 'draft'::text NOT NULL,
    notes text,
    sent_at timestamp with time zone,
    sent_to_email text,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    file_path text,
    file_name text,
    file_size bigint,
    file_type text,
    CONSTRAINT valid_quotation_status CHECK ((status = ANY (ARRAY['draft'::text, 'sent'::text, 'approved'::text, 'rejected'::text])))
);


--
-- Name: project_tasks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.project_tasks (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    project_id uuid,
    task_name text NOT NULL,
    description text,
    assigned_to uuid NOT NULL,
    assigned_by uuid NOT NULL,
    due_date date NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    priority text DEFAULT 'medium'::text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    completed_at timestamp with time zone,
    CONSTRAINT valid_priority CHECK ((priority = ANY (ARRAY['low'::text, 'medium'::text, 'high'::text, 'urgent'::text]))),
    CONSTRAINT valid_status CHECK ((status = ANY (ARRAY['pending'::text, 'in_progress'::text, 'completed'::text, 'cancelled'::text])))
);


--
-- Name: project_team_members; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.project_team_members (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    project_id uuid NOT NULL,
    user_id uuid NOT NULL,
    role_in_project text DEFAULT 'member'::text NOT NULL,
    assigned_by uuid,
    assigned_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT valid_role CHECK ((role_in_project = ANY (ARRAY['lead'::text, 'member'::text, 'consultant'::text])))
);


--
-- Name: project_team_notifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.project_team_notifications (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    project_id uuid NOT NULL,
    user_id uuid NOT NULL,
    notified_at timestamp with time zone DEFAULT now() NOT NULL,
    notification_type text DEFAULT 'project_assignment'::text NOT NULL
);


--
-- Name: role_metadata; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.role_metadata (
    role public.app_role NOT NULL,
    display_name text NOT NULL,
    description text,
    can_be_assigned_by public.app_role[] DEFAULT '{}'::public.app_role[] NOT NULL,
    is_visible_in_ui boolean DEFAULT true NOT NULL,
    hierarchy_level integer NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: sms_templates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sms_templates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    body text NOT NULL,
    category text,
    is_active boolean DEFAULT true NOT NULL,
    version integer DEFAULT 1 NOT NULL,
    character_count integer,
    merge_tags text[],
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: sync_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sync_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    sync_type text NOT NULL,
    sync_id uuid,
    status text NOT NULL,
    items_fetched integer DEFAULT 0,
    items_inserted integer DEFAULT 0,
    items_updated integer DEFAULT 0,
    items_failed integer DEFAULT 0,
    duration_seconds numeric,
    error_details jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: sync_status; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sync_status (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    sync_type text NOT NULL,
    status text DEFAULT 'running'::text NOT NULL,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    completed_at timestamp with time zone,
    started_by uuid,
    total_items integer DEFAULT 0,
    processed_items integer DEFAULT 0,
    error_message text
);


--
-- Name: team_members; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.team_members (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    team_id uuid NOT NULL,
    user_id uuid NOT NULL,
    joined_at timestamp with time zone DEFAULT now() NOT NULL,
    role_in_team text DEFAULT 'member'::text,
    is_active boolean DEFAULT true
);


--
-- Name: teams; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.teams (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    description text,
    team_lead_id uuid,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid
);


--
-- Name: user_announcement_views; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_announcement_views (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    announcement_id uuid NOT NULL,
    viewed_at timestamp with time zone DEFAULT now() NOT NULL,
    dismissed boolean DEFAULT false
);


--
-- Name: user_designations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_designations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    designation_id uuid NOT NULL,
    assigned_at timestamp with time zone DEFAULT now() NOT NULL,
    assigned_by uuid,
    is_current boolean DEFAULT true
);


--
-- Name: user_onboarding_progress; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_onboarding_progress (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    tour_id uuid NOT NULL,
    status public.onboarding_status DEFAULT 'not_started'::public.onboarding_status,
    current_step_id uuid,
    completed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: user_roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_roles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    role public.app_role DEFAULT 'user'::public.app_role NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: vendors; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.vendors (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    vendor_name text NOT NULL,
    vendor_type text NOT NULL,
    contact_person text,
    contact_no text,
    email_id text,
    address text,
    city text,
    state text,
    pin_code text,
    gst text,
    department text,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT vendors_vendor_type_check CHECK ((vendor_type = ANY (ARRAY['IT'::text, 'Operations'::text, 'HRAF'::text, 'Others'::text])))
);


--
-- Name: webhook_connectors; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.webhook_connectors (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    connector_type text NOT NULL,
    webhook_token text NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    rate_limit_per_minute integer DEFAULT 60 NOT NULL,
    webhook_config jsonb DEFAULT '{}'::jsonb,
    target_table text DEFAULT 'demandcom'::text NOT NULL,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: webhook_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.webhook_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    webhook_connector_id uuid,
    request_id text NOT NULL,
    status text NOT NULL,
    http_status_code integer NOT NULL,
    request_payload jsonb,
    response_payload jsonb,
    error_message text,
    demandcom_id uuid,
    job_id uuid,
    ip_address text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: attendance_policies attendance_policies_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attendance_policies
    ADD CONSTRAINT attendance_policies_pkey PRIMARY KEY (id);


--
-- Name: attendance_records attendance_records_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attendance_records
    ADD CONSTRAINT attendance_records_pkey PRIMARY KEY (id);


--
-- Name: attendance_records attendance_records_user_id_date_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attendance_records
    ADD CONSTRAINT attendance_records_user_id_date_key UNIQUE (user_id, date);


--
-- Name: bulk_import_history bulk_import_history_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bulk_import_history
    ADD CONSTRAINT bulk_import_history_pkey PRIMARY KEY (id);


--
-- Name: bulk_import_records bulk_import_records_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bulk_import_records
    ADD CONSTRAINT bulk_import_records_pkey PRIMARY KEY (id);


--
-- Name: call_dispositions call_dispositions_disposition_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.call_dispositions
    ADD CONSTRAINT call_dispositions_disposition_key UNIQUE (disposition);


--
-- Name: call_dispositions call_dispositions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.call_dispositions
    ADD CONSTRAINT call_dispositions_pkey PRIMARY KEY (id);


--
-- Name: call_logs call_logs_call_sid_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.call_logs
    ADD CONSTRAINT call_logs_call_sid_key UNIQUE (call_sid);


--
-- Name: call_logs call_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.call_logs
    ADD CONSTRAINT call_logs_pkey PRIMARY KEY (id);


--
-- Name: campaign_links campaign_links_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaign_links
    ADD CONSTRAINT campaign_links_pkey PRIMARY KEY (id);


--
-- Name: campaign_links campaign_links_short_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaign_links
    ADD CONSTRAINT campaign_links_short_code_key UNIQUE (short_code);


--
-- Name: campaign_recipients campaign_recipients_campaign_id_candidate_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaign_recipients
    ADD CONSTRAINT campaign_recipients_campaign_id_candidate_id_key UNIQUE (campaign_id, demandcom_id);


--
-- Name: campaign_recipients campaign_recipients_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaign_recipients
    ADD CONSTRAINT campaign_recipients_pkey PRIMARY KEY (id);


--
-- Name: campaigns campaigns_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaigns
    ADD CONSTRAINT campaigns_pkey PRIMARY KEY (id);


--
-- Name: demandcom_pipeline candidate_pipeline_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.demandcom_pipeline
    ADD CONSTRAINT candidate_pipeline_pkey PRIMARY KEY (id);


--
-- Name: demandcom candidates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.demandcom
    ADD CONSTRAINT candidates_pkey PRIMARY KEY (id);


--
-- Name: master clients_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.master
    ADD CONSTRAINT clients_pkey PRIMARY KEY (mobile_numb);


--
-- Name: clients clients_pkey1; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clients
    ADD CONSTRAINT clients_pkey1 PRIMARY KEY (id);


--
-- Name: csbd_projection_audit csbd_projection_audit_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.csbd_projection_audit
    ADD CONSTRAINT csbd_projection_audit_pkey PRIMARY KEY (id);


--
-- Name: csbd_projections csbd_projections_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.csbd_projections
    ADD CONSTRAINT csbd_projections_pkey PRIMARY KEY (id);


--
-- Name: csbd_projections csbd_projections_user_id_month_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.csbd_projections
    ADD CONSTRAINT csbd_projections_user_id_month_key UNIQUE (user_id, month);


--
-- Name: csbd_targets csbd_targets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.csbd_targets
    ADD CONSTRAINT csbd_targets_pkey PRIMARY KEY (id);


--
-- Name: csbd_targets csbd_targets_user_id_fiscal_year_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.csbd_targets
    ADD CONSTRAINT csbd_targets_user_id_fiscal_year_key UNIQUE (user_id, fiscal_year);


--
-- Name: designations designations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.designations
    ADD CONSTRAINT designations_pkey PRIMARY KEY (id);


--
-- Name: designations designations_title_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.designations
    ADD CONSTRAINT designations_title_key UNIQUE (title);


--
-- Name: email_templates email_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_templates
    ADD CONSTRAINT email_templates_pkey PRIMARY KEY (id);


--
-- Name: export_jobs export_jobs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.export_jobs
    ADD CONSTRAINT export_jobs_pkey PRIMARY KEY (id);


--
-- Name: feature_announcements feature_announcements_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.feature_announcements
    ADD CONSTRAINT feature_announcements_pkey PRIMARY KEY (id);


--
-- Name: general_tasks general_tasks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.general_tasks
    ADD CONSTRAINT general_tasks_pkey PRIMARY KEY (id);


--
-- Name: inbound_sms inbound_sms_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inbound_sms
    ADD CONSTRAINT inbound_sms_pkey PRIMARY KEY (id);


--
-- Name: inventory_allocations inventory_allocations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_allocations
    ADD CONSTRAINT inventory_allocations_pkey PRIMARY KEY (id);


--
-- Name: inventory_audit_log inventory_audit_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_audit_log
    ADD CONSTRAINT inventory_audit_log_pkey PRIMARY KEY (id);


--
-- Name: inventory_items inventory_items_invoice_no_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_items
    ADD CONSTRAINT inventory_items_invoice_no_key UNIQUE (invoice_no);


--
-- Name: inventory_items inventory_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_items
    ADD CONSTRAINT inventory_items_pkey PRIMARY KEY (id);


--
-- Name: inventory_items inventory_items_serial_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_items
    ADD CONSTRAINT inventory_items_serial_number_key UNIQUE (serial_number);


--
-- Name: jobs jobs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.jobs
    ADD CONSTRAINT jobs_pkey PRIMARY KEY (id);


--
-- Name: leave_applications leave_applications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leave_applications
    ADD CONSTRAINT leave_applications_pkey PRIMARY KEY (id);


--
-- Name: leave_balances leave_balances_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leave_balances
    ADD CONSTRAINT leave_balances_pkey PRIMARY KEY (id);


--
-- Name: leave_balances leave_balances_user_id_year_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leave_balances
    ADD CONSTRAINT leave_balances_user_id_year_key UNIQUE (user_id, year);


--
-- Name: notifications notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);


--
-- Name: onboarding_steps onboarding_steps_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.onboarding_steps
    ADD CONSTRAINT onboarding_steps_pkey PRIMARY KEY (id);


--
-- Name: onboarding_tours onboarding_tours_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.onboarding_tours
    ADD CONSTRAINT onboarding_tours_pkey PRIMARY KEY (id);


--
-- Name: password_reset_logs password_reset_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.password_reset_logs
    ADD CONSTRAINT password_reset_logs_pkey PRIMARY KEY (id);


--
-- Name: pipeline_stages pipeline_stages_name_stage_type_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pipeline_stages
    ADD CONSTRAINT pipeline_stages_name_stage_type_key UNIQUE (name, stage_type);


--
-- Name: pipeline_stages pipeline_stages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pipeline_stages
    ADD CONSTRAINT pipeline_stages_pkey PRIMARY KEY (id);


--
-- Name: profiles profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);


--
-- Name: project_demandcom_checklist project_demandcom_checklist_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_demandcom_checklist
    ADD CONSTRAINT project_demandcom_checklist_pkey PRIMARY KEY (id);


--
-- Name: project_demandcom_checklist project_demandcom_checklist_project_id_checklist_item_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_demandcom_checklist
    ADD CONSTRAINT project_demandcom_checklist_project_id_checklist_item_key UNIQUE (project_id, checklist_item);


--
-- Name: project_digicom_checklist project_digicom_checklist_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_digicom_checklist
    ADD CONSTRAINT project_digicom_checklist_pkey PRIMARY KEY (id);


--
-- Name: project_digicom_checklist project_digicom_checklist_project_id_checklist_item_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_digicom_checklist
    ADD CONSTRAINT project_digicom_checklist_project_id_checklist_item_key UNIQUE (project_id, checklist_item);


--
-- Name: project_files project_files_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_files
    ADD CONSTRAINT project_files_pkey PRIMARY KEY (id);


--
-- Name: project_livecom_checklist project_livecom_checklist_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_livecom_checklist
    ADD CONSTRAINT project_livecom_checklist_pkey PRIMARY KEY (id);


--
-- Name: project_livecom_checklist project_livecom_checklist_project_id_checklist_item_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_livecom_checklist
    ADD CONSTRAINT project_livecom_checklist_project_id_checklist_item_key UNIQUE (project_id, checklist_item);


--
-- Name: project_quotations project_quotations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_quotations
    ADD CONSTRAINT project_quotations_pkey PRIMARY KEY (id);


--
-- Name: project_quotations project_quotations_quotation_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_quotations
    ADD CONSTRAINT project_quotations_quotation_number_key UNIQUE (quotation_number);


--
-- Name: project_tasks project_tasks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_tasks
    ADD CONSTRAINT project_tasks_pkey PRIMARY KEY (id);


--
-- Name: project_team_members project_team_members_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_team_members
    ADD CONSTRAINT project_team_members_pkey PRIMARY KEY (id);


--
-- Name: project_team_members project_team_members_project_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_team_members
    ADD CONSTRAINT project_team_members_project_id_user_id_key UNIQUE (project_id, user_id);


--
-- Name: project_team_notifications project_team_notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_team_notifications
    ADD CONSTRAINT project_team_notifications_pkey PRIMARY KEY (id);


--
-- Name: project_team_notifications project_team_notifications_project_id_user_id_notification__key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_team_notifications
    ADD CONSTRAINT project_team_notifications_project_id_user_id_notification__key UNIQUE (project_id, user_id, notification_type);


--
-- Name: projects projects_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.projects
    ADD CONSTRAINT projects_pkey PRIMARY KEY (id);


--
-- Name: projects projects_project_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.projects
    ADD CONSTRAINT projects_project_number_key UNIQUE (project_number);


--
-- Name: role_metadata role_metadata_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.role_metadata
    ADD CONSTRAINT role_metadata_pkey PRIMARY KEY (role);


--
-- Name: sms_templates sms_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sms_templates
    ADD CONSTRAINT sms_templates_pkey PRIMARY KEY (id);


--
-- Name: sync_logs sync_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sync_logs
    ADD CONSTRAINT sync_logs_pkey PRIMARY KEY (id);


--
-- Name: sync_status sync_status_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sync_status
    ADD CONSTRAINT sync_status_pkey PRIMARY KEY (id);


--
-- Name: team_members team_members_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.team_members
    ADD CONSTRAINT team_members_pkey PRIMARY KEY (id);


--
-- Name: team_members team_members_team_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.team_members
    ADD CONSTRAINT team_members_team_id_user_id_key UNIQUE (team_id, user_id);


--
-- Name: teams teams_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.teams
    ADD CONSTRAINT teams_name_key UNIQUE (name);


--
-- Name: teams teams_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.teams
    ADD CONSTRAINT teams_pkey PRIMARY KEY (id);


--
-- Name: user_announcement_views user_announcement_views_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_announcement_views
    ADD CONSTRAINT user_announcement_views_pkey PRIMARY KEY (id);


--
-- Name: user_announcement_views user_announcement_views_user_id_announcement_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_announcement_views
    ADD CONSTRAINT user_announcement_views_user_id_announcement_id_key UNIQUE (user_id, announcement_id);


--
-- Name: user_designations user_designations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_designations
    ADD CONSTRAINT user_designations_pkey PRIMARY KEY (id);


--
-- Name: user_designations user_designations_user_id_designation_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_designations
    ADD CONSTRAINT user_designations_user_id_designation_id_key UNIQUE (user_id, designation_id);


--
-- Name: user_onboarding_progress user_onboarding_progress_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_onboarding_progress
    ADD CONSTRAINT user_onboarding_progress_pkey PRIMARY KEY (id);


--
-- Name: user_onboarding_progress user_onboarding_progress_user_id_tour_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_onboarding_progress
    ADD CONSTRAINT user_onboarding_progress_user_id_tour_id_key UNIQUE (user_id, tour_id);


--
-- Name: user_roles user_roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_pkey PRIMARY KEY (id);


--
-- Name: user_roles user_roles_user_id_role_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_user_id_role_key UNIQUE (user_id, role);


--
-- Name: vendors vendors_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vendors
    ADD CONSTRAINT vendors_pkey PRIMARY KEY (id);


--
-- Name: webhook_connectors webhook_connectors_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.webhook_connectors
    ADD CONSTRAINT webhook_connectors_pkey PRIMARY KEY (id);


--
-- Name: webhook_connectors webhook_connectors_webhook_token_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.webhook_connectors
    ADD CONSTRAINT webhook_connectors_webhook_token_key UNIQUE (webhook_token);


--
-- Name: webhook_logs webhook_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.webhook_logs
    ADD CONSTRAINT webhook_logs_pkey PRIMARY KEY (id);


--
-- Name: webhook_logs webhook_logs_request_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.webhook_logs
    ADD CONSTRAINT webhook_logs_request_id_key UNIQUE (request_id);


--
-- Name: idx_allocations_item; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_allocations_item ON public.inventory_allocations USING btree (inventory_item_id);


--
-- Name: idx_allocations_return_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_allocations_return_date ON public.inventory_allocations USING btree (expected_return_date);


--
-- Name: idx_allocations_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_allocations_status ON public.inventory_allocations USING btree (status);


--
-- Name: idx_allocations_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_allocations_user ON public.inventory_allocations USING btree (user_id);


--
-- Name: idx_attendance_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_attendance_date ON public.attendance_records USING btree (date);


--
-- Name: idx_attendance_user_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_attendance_user_date ON public.attendance_records USING btree (user_id, date);


--
-- Name: idx_audit_item; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_item ON public.inventory_audit_log USING btree (inventory_item_id);


--
-- Name: idx_audit_timestamp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_timestamp ON public.inventory_audit_log USING btree ("timestamp" DESC);


--
-- Name: idx_call_logs_call_method; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_call_logs_call_method ON public.call_logs USING btree (call_method);


--
-- Name: idx_call_logs_call_sid; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_call_logs_call_sid ON public.call_logs USING btree (call_sid);


--
-- Name: idx_call_logs_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_call_logs_created_at ON public.call_logs USING btree (created_at DESC);


--
-- Name: idx_call_logs_demandcom_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_call_logs_demandcom_date ON public.call_logs USING btree (demandcom_id, disposition_set_at DESC);


--
-- Name: idx_call_logs_demandcom_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_call_logs_demandcom_id ON public.call_logs USING btree (demandcom_id);


--
-- Name: idx_call_logs_demandcom_id_method; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_call_logs_demandcom_id_method ON public.call_logs USING btree (demandcom_id, call_method);


--
-- Name: idx_call_logs_initiated_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_call_logs_initiated_by ON public.call_logs USING btree (initiated_by);


--
-- Name: idx_call_logs_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_call_logs_status ON public.call_logs USING btree (status);


--
-- Name: idx_campaign_links_campaign_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_campaign_links_campaign_id ON public.campaign_links USING btree (campaign_id);


--
-- Name: idx_campaign_links_short_code; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_campaign_links_short_code ON public.campaign_links USING btree (short_code);


--
-- Name: idx_campaign_recipients_campaign_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_campaign_recipients_campaign_id ON public.campaign_recipients USING btree (campaign_id);


--
-- Name: idx_campaign_recipients_candidate_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_campaign_recipients_candidate_id ON public.campaign_recipients USING btree (demandcom_id);


--
-- Name: idx_campaign_recipients_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_campaign_recipients_status ON public.campaign_recipients USING btree (status);


--
-- Name: idx_campaigns_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_campaigns_created_at ON public.campaigns USING btree (created_at DESC);


--
-- Name: idx_campaigns_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_campaigns_status ON public.campaigns USING btree (status);


--
-- Name: idx_campaigns_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_campaigns_type ON public.campaigns USING btree (type);


--
-- Name: idx_candidate_pipeline_candidate; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_candidate_pipeline_candidate ON public.demandcom_pipeline USING btree (demandcom_id);


--
-- Name: idx_candidate_pipeline_current; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_candidate_pipeline_current ON public.demandcom_pipeline USING btree (is_current) WHERE (is_current = true);


--
-- Name: idx_candidate_pipeline_stage; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_candidate_pipeline_stage ON public.demandcom_pipeline USING btree (stage_id);


--
-- Name: idx_candidates_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_candidates_created_at ON public.demandcom USING btree (created_at DESC);


--
-- Name: idx_candidates_location; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_candidates_location ON public.demandcom USING btree (state, city);


--
-- Name: idx_clients_company_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_clients_company_name ON public.master USING btree (company_name);


--
-- Name: idx_clients_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_clients_name ON public.master USING btree (name);


--
-- Name: idx_csbd_projection_audit_changed_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_csbd_projection_audit_changed_at ON public.csbd_projection_audit USING btree (changed_at);


--
-- Name: idx_csbd_projection_audit_projection_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_csbd_projection_audit_projection_id ON public.csbd_projection_audit USING btree (projection_id);


--
-- Name: idx_csbd_projection_audit_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_csbd_projection_audit_user_id ON public.csbd_projection_audit USING btree (user_id);


--
-- Name: idx_csbd_projections_month; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_csbd_projections_month ON public.csbd_projections USING btree (month);


--
-- Name: idx_csbd_projections_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_csbd_projections_user_id ON public.csbd_projections USING btree (user_id);


--
-- Name: idx_csbd_projections_user_month; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_csbd_projections_user_month ON public.csbd_projections USING btree (user_id, month);


--
-- Name: idx_csbd_targets_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_csbd_targets_active ON public.csbd_targets USING btree (is_active) WHERE (is_active = true);


--
-- Name: idx_csbd_targets_fiscal_year; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_csbd_targets_fiscal_year ON public.csbd_targets USING btree (fiscal_year);


--
-- Name: idx_csbd_targets_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_csbd_targets_user_id ON public.csbd_targets USING btree (user_id);


--
-- Name: idx_demandcom_assigned_to; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_demandcom_assigned_to ON public.demandcom USING btree (assigned_to);


--
-- Name: idx_demandcom_assignment_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_demandcom_assignment_status ON public.demandcom USING btree (assignment_status);


--
-- Name: idx_email_templates_category; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_email_templates_category ON public.email_templates USING btree (category);


--
-- Name: idx_export_jobs_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_export_jobs_created_at ON public.export_jobs USING btree (created_at DESC);


--
-- Name: idx_export_jobs_user_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_export_jobs_user_status ON public.export_jobs USING btree (user_id, status);


--
-- Name: idx_feature_announcements_published; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_feature_announcements_published ON public.feature_announcements USING btree (published_at DESC) WHERE (is_active = true);


--
-- Name: idx_import_history_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_import_history_status ON public.bulk_import_history USING btree (status);


--
-- Name: idx_import_history_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_import_history_user ON public.bulk_import_history USING btree (user_id, created_at DESC);


--
-- Name: idx_import_records_import; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_import_records_import ON public.bulk_import_records USING btree (import_id);


--
-- Name: idx_import_records_target; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_import_records_target ON public.bulk_import_records USING btree (table_name, record_id);


--
-- Name: idx_inbound_sms_campaign_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_inbound_sms_campaign_id ON public.inbound_sms USING btree (campaign_id);


--
-- Name: idx_inbound_sms_candidate_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_inbound_sms_candidate_id ON public.inbound_sms USING btree (demandcom_id);


--
-- Name: idx_inbound_sms_from_number; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_inbound_sms_from_number ON public.inbound_sms USING btree (from_number);


--
-- Name: idx_inbound_sms_received_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_inbound_sms_received_at ON public.inbound_sms USING btree (received_at DESC);


--
-- Name: idx_inventory_created_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_inventory_created_by ON public.inventory_items USING btree (created_by);


--
-- Name: idx_inventory_date_of_purchase; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_inventory_date_of_purchase ON public.inventory_items USING btree (date_of_purchase);


--
-- Name: idx_inventory_gst_slab; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_inventory_gst_slab ON public.inventory_items USING btree (gst_slab);


--
-- Name: idx_inventory_invoice_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_inventory_invoice_date ON public.inventory_items USING btree (invoice_date);


--
-- Name: idx_inventory_invoice_no; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_inventory_invoice_no ON public.inventory_items USING btree (invoice_no);


--
-- Name: idx_inventory_serial; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_inventory_serial ON public.inventory_items USING btree (serial_number);


--
-- Name: idx_inventory_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_inventory_status ON public.inventory_items USING btree (status);


--
-- Name: idx_inventory_vendor_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_inventory_vendor_name ON public.inventory_items USING btree (vendor_name);


--
-- Name: idx_jobs_client_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_jobs_client_id ON public.jobs USING btree (client_id);


--
-- Name: idx_jobs_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_jobs_status ON public.jobs USING btree (status);


--
-- Name: idx_leave_balance_user_year; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_leave_balance_user_year ON public.leave_balances USING btree (user_id, year);


--
-- Name: idx_leave_dates; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_leave_dates ON public.leave_applications USING btree (start_date, end_date);


--
-- Name: idx_leave_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_leave_status ON public.leave_applications USING btree (status);


--
-- Name: idx_leave_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_leave_user ON public.leave_applications USING btree (user_id);


--
-- Name: idx_master_created_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_master_created_by ON public.master USING btree (created_by);


--
-- Name: idx_master_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_master_id ON public.master USING btree (id);


--
-- Name: idx_notifications_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notifications_created_at ON public.notifications USING btree (created_at DESC);


--
-- Name: idx_notifications_is_read; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notifications_is_read ON public.notifications USING btree (is_read);


--
-- Name: idx_notifications_task_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notifications_task_id ON public.notifications USING btree (task_id);


--
-- Name: idx_notifications_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notifications_user_id ON public.notifications USING btree (user_id);


--
-- Name: idx_onboarding_steps_tour; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_onboarding_steps_tour ON public.onboarding_steps USING btree (tour_id, step_order);


--
-- Name: idx_onboarding_tours_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_onboarding_tours_active ON public.onboarding_tours USING btree (is_active);


--
-- Name: idx_onboarding_tours_version; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_onboarding_tours_version ON public.onboarding_tours USING btree (version);


--
-- Name: idx_password_reset_logs_admin_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_password_reset_logs_admin_user ON public.password_reset_logs USING btree (admin_user_id);


--
-- Name: idx_password_reset_logs_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_password_reset_logs_created_at ON public.password_reset_logs USING btree (created_at DESC);


--
-- Name: idx_password_reset_logs_target_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_password_reset_logs_target_user ON public.password_reset_logs USING btree (target_user_id);


--
-- Name: idx_pipeline_stages_type_order; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pipeline_stages_type_order ON public.pipeline_stages USING btree (stage_type, stage_order);


--
-- Name: idx_profiles_reports_to; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_profiles_reports_to ON public.profiles USING btree (reports_to);


--
-- Name: idx_project_demandcom_project_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_project_demandcom_project_id ON public.project_demandcom_checklist USING btree (project_id);


--
-- Name: idx_project_digicom_project_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_project_digicom_project_id ON public.project_digicom_checklist USING btree (project_id);


--
-- Name: idx_project_files_project_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_project_files_project_id ON public.project_files USING btree (project_id);


--
-- Name: idx_project_livecom_project_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_project_livecom_project_id ON public.project_livecom_checklist USING btree (project_id);


--
-- Name: idx_project_quotations_project_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_project_quotations_project_id ON public.project_quotations USING btree (project_id);


--
-- Name: idx_project_tasks_assigned_to; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_project_tasks_assigned_to ON public.project_tasks USING btree (assigned_to);


--
-- Name: idx_project_tasks_due_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_project_tasks_due_date ON public.project_tasks USING btree (due_date);


--
-- Name: idx_project_tasks_project_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_project_tasks_project_id ON public.project_tasks USING btree (project_id);


--
-- Name: idx_project_tasks_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_project_tasks_status ON public.project_tasks USING btree (status);


--
-- Name: idx_project_team_members_project_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_project_team_members_project_id ON public.project_team_members USING btree (project_id);


--
-- Name: idx_project_team_members_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_project_team_members_user_id ON public.project_team_members USING btree (user_id);


--
-- Name: idx_project_team_notifications_project; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_project_team_notifications_project ON public.project_team_notifications USING btree (project_id);


--
-- Name: idx_project_team_notifications_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_project_team_notifications_user ON public.project_team_notifications USING btree (user_id);


--
-- Name: idx_projects_client_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_projects_client_id ON public.projects USING btree (client_id);


--
-- Name: idx_projects_created_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_projects_created_by ON public.projects USING btree (created_by);


--
-- Name: idx_projects_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_projects_status ON public.projects USING btree (status);


--
-- Name: idx_sms_templates_category; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sms_templates_category ON public.sms_templates USING btree (category);


--
-- Name: idx_sync_logs_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sync_logs_created_at ON public.sync_logs USING btree (created_at DESC);


--
-- Name: idx_sync_status_type_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sync_status_type_status ON public.sync_status USING btree (sync_type, status);


--
-- Name: idx_team_members_team; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_team_members_team ON public.team_members USING btree (team_id);


--
-- Name: idx_team_members_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_team_members_user ON public.team_members USING btree (user_id);


--
-- Name: idx_teams_team_lead; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_teams_team_lead ON public.teams USING btree (team_lead_id);


--
-- Name: idx_user_announcement_views_announcement; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_announcement_views_announcement ON public.user_announcement_views USING btree (announcement_id);


--
-- Name: idx_user_announcement_views_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_announcement_views_user ON public.user_announcement_views USING btree (user_id);


--
-- Name: idx_user_designations_designation; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_designations_designation ON public.user_designations USING btree (designation_id);


--
-- Name: idx_user_designations_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_designations_user ON public.user_designations USING btree (user_id);


--
-- Name: idx_user_progress_tour; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_progress_tour ON public.user_onboarding_progress USING btree (tour_id);


--
-- Name: idx_user_progress_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_progress_user ON public.user_onboarding_progress USING btree (user_id);


--
-- Name: idx_user_roles_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_roles_user_id ON public.user_roles USING btree (user_id);


--
-- Name: idx_vendors_created_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_vendors_created_by ON public.vendors USING btree (created_by);


--
-- Name: idx_vendors_department; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_vendors_department ON public.vendors USING btree (department);


--
-- Name: idx_vendors_vendor_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_vendors_vendor_name ON public.vendors USING btree (vendor_name);


--
-- Name: idx_vendors_vendor_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_vendors_vendor_type ON public.vendors USING btree (vendor_type);


--
-- Name: idx_webhook_connectors_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_webhook_connectors_active ON public.webhook_connectors USING btree (is_active);


--
-- Name: idx_webhook_connectors_token; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_webhook_connectors_token ON public.webhook_connectors USING btree (webhook_token);


--
-- Name: idx_webhook_logs_connector_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_webhook_logs_connector_id ON public.webhook_logs USING btree (webhook_connector_id);


--
-- Name: idx_webhook_logs_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_webhook_logs_created_at ON public.webhook_logs USING btree (created_at DESC);


--
-- Name: idx_webhook_logs_request_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_webhook_logs_request_id ON public.webhook_logs USING btree (request_id);


--
-- Name: inventory_allocations allocation_audit_trigger; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER allocation_audit_trigger AFTER INSERT OR UPDATE ON public.inventory_allocations FOR EACH ROW EXECUTE FUNCTION public.log_allocation_audit();


--
-- Name: csbd_projections csbd_projection_audit_trigger; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER csbd_projection_audit_trigger AFTER INSERT OR DELETE OR UPDATE ON public.csbd_projections FOR EACH ROW EXECUTE FUNCTION public.log_csbd_projection_change();


--
-- Name: inventory_items inventory_audit_trigger; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER inventory_audit_trigger AFTER UPDATE ON public.inventory_items FOR EACH ROW EXECUTE FUNCTION public.log_inventory_audit();


--
-- Name: general_tasks notify_general_task_assignment_trigger; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER notify_general_task_assignment_trigger AFTER INSERT OR UPDATE ON public.general_tasks FOR EACH ROW EXECUTE FUNCTION public.notify_general_task_assignment();


--
-- Name: project_tasks send_task_assignment_email_trigger; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER send_task_assignment_email_trigger AFTER INSERT OR UPDATE OF assigned_to ON public.project_tasks FOR EACH ROW EXECUTE FUNCTION public.send_task_assignment_email();


--
-- Name: project_tasks task_assignment_notification; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER task_assignment_notification AFTER INSERT OR UPDATE OF assigned_to ON public.project_tasks FOR EACH ROW EXECUTE FUNCTION public.notify_task_assignment();


--
-- Name: attendance_records trigger_calculate_attendance_hours; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_calculate_attendance_hours BEFORE INSERT OR UPDATE ON public.attendance_records FOR EACH ROW EXECUTE FUNCTION public.calculate_attendance_hours();


--
-- Name: call_logs trigger_update_disposition; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_update_disposition AFTER INSERT OR UPDATE OF disposition, subdisposition ON public.call_logs FOR EACH ROW WHEN (((new.disposition IS NOT NULL) AND (new.disposition <> ''::text))) EXECUTE FUNCTION public.update_demandcom_latest_disposition();


--
-- Name: leave_applications trigger_update_leave_balance; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_update_leave_balance AFTER UPDATE ON public.leave_applications FOR EACH ROW EXECUTE FUNCTION public.update_leave_balance();


--
-- Name: project_tasks trigger_update_project_tasks_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_update_project_tasks_updated_at BEFORE UPDATE ON public.project_tasks FOR EACH ROW EXECUTE FUNCTION public.update_project_tasks_updated_at();


--
-- Name: call_logs update_call_logs_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_call_logs_updated_at BEFORE UPDATE ON public.call_logs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: campaign_recipients update_campaign_recipients_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_campaign_recipients_updated_at BEFORE UPDATE ON public.campaign_recipients FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: campaigns update_campaigns_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_campaigns_updated_at BEFORE UPDATE ON public.campaigns FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: demandcom update_candidates_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_candidates_updated_at BEFORE UPDATE ON public.demandcom FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: clients update_clients_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_clients_updated_at BEFORE UPDATE ON public.clients FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: csbd_projections update_csbd_projections_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_csbd_projections_updated_at BEFORE UPDATE ON public.csbd_projections FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: csbd_targets update_csbd_targets_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_csbd_targets_updated_at BEFORE UPDATE ON public.csbd_targets FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: designations update_designations_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_designations_updated_at BEFORE UPDATE ON public.designations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: email_templates update_email_templates_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_email_templates_updated_at BEFORE UPDATE ON public.email_templates FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: export_jobs update_export_jobs_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_export_jobs_updated_at BEFORE UPDATE ON public.export_jobs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: feature_announcements update_feature_announcements_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_feature_announcements_updated_at BEFORE UPDATE ON public.feature_announcements FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: general_tasks update_general_tasks_status; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_general_tasks_status BEFORE UPDATE ON public.general_tasks FOR EACH ROW EXECUTE FUNCTION public.update_general_tasks_completed_at();


--
-- Name: general_tasks update_general_tasks_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_general_tasks_updated_at BEFORE UPDATE ON public.general_tasks FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: inventory_items update_inventory_items_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_inventory_items_updated_at BEFORE UPDATE ON public.inventory_items FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: jobs update_jobs_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_jobs_updated_at BEFORE UPDATE ON public.jobs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: master update_master_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_master_updated_at BEFORE UPDATE ON public.master FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: onboarding_tours update_onboarding_tours_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_onboarding_tours_updated_at BEFORE UPDATE ON public.onboarding_tours FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: pipeline_stages update_pipeline_stages_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_pipeline_stages_updated_at BEFORE UPDATE ON public.pipeline_stages FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: profiles update_profiles_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: project_demandcom_checklist update_project_demandcom_timestamp; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_project_demandcom_timestamp BEFORE UPDATE ON public.project_demandcom_checklist FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: project_digicom_checklist update_project_digicom_timestamp; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_project_digicom_timestamp BEFORE UPDATE ON public.project_digicom_checklist FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: project_livecom_checklist update_project_livecom_timestamp; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_project_livecom_timestamp BEFORE UPDATE ON public.project_livecom_checklist FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: project_quotations update_project_quotations_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_project_quotations_updated_at BEFORE UPDATE ON public.project_quotations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: projects update_projects_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON public.projects FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: sms_templates update_sms_templates_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_sms_templates_updated_at BEFORE UPDATE ON public.sms_templates FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: teams update_teams_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_teams_updated_at BEFORE UPDATE ON public.teams FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: user_onboarding_progress update_user_onboarding_progress_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_user_onboarding_progress_updated_at BEFORE UPDATE ON public.user_onboarding_progress FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: vendors update_vendors_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_vendors_updated_at BEFORE UPDATE ON public.vendors FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: webhook_connectors update_webhook_connectors_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_webhook_connectors_updated_at BEFORE UPDATE ON public.webhook_connectors FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: attendance_records attendance_records_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attendance_records
    ADD CONSTRAINT attendance_records_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: bulk_import_records bulk_import_records_import_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bulk_import_records
    ADD CONSTRAINT bulk_import_records_import_id_fkey FOREIGN KEY (import_id) REFERENCES public.bulk_import_history(id) ON DELETE CASCADE;


--
-- Name: call_logs call_logs_demandcom_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.call_logs
    ADD CONSTRAINT call_logs_demandcom_id_fkey FOREIGN KEY (demandcom_id) REFERENCES public.demandcom(id) ON DELETE CASCADE;


--
-- Name: call_logs call_logs_disposition_set_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.call_logs
    ADD CONSTRAINT call_logs_disposition_set_by_fkey FOREIGN KEY (disposition_set_by) REFERENCES public.profiles(id);


--
-- Name: call_logs call_logs_initiated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.call_logs
    ADD CONSTRAINT call_logs_initiated_by_fkey FOREIGN KEY (initiated_by) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: campaign_links campaign_links_campaign_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaign_links
    ADD CONSTRAINT campaign_links_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES public.campaigns(id) ON DELETE CASCADE;


--
-- Name: campaign_recipients campaign_recipients_campaign_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaign_recipients
    ADD CONSTRAINT campaign_recipients_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES public.campaigns(id) ON DELETE CASCADE;


--
-- Name: campaign_recipients campaign_recipients_candidate_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaign_recipients
    ADD CONSTRAINT campaign_recipients_candidate_id_fkey FOREIGN KEY (demandcom_id) REFERENCES public.demandcom(id) ON DELETE CASCADE;


--
-- Name: campaign_recipients campaign_recipients_demandcom_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaign_recipients
    ADD CONSTRAINT campaign_recipients_demandcom_id_fkey FOREIGN KEY (demandcom_id) REFERENCES public.demandcom(id) ON DELETE SET NULL;


--
-- Name: campaigns campaigns_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaigns
    ADD CONSTRAINT campaigns_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);


--
-- Name: demandcom_pipeline candidate_pipeline_candidate_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.demandcom_pipeline
    ADD CONSTRAINT candidate_pipeline_candidate_id_fkey FOREIGN KEY (demandcom_id) REFERENCES public.demandcom(id) ON DELETE CASCADE;


--
-- Name: demandcom_pipeline candidate_pipeline_moved_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.demandcom_pipeline
    ADD CONSTRAINT candidate_pipeline_moved_by_fkey FOREIGN KEY (moved_by) REFERENCES auth.users(id);


--
-- Name: demandcom_pipeline candidate_pipeline_stage_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.demandcom_pipeline
    ADD CONSTRAINT candidate_pipeline_stage_id_fkey FOREIGN KEY (stage_id) REFERENCES public.pipeline_stages(id) ON DELETE CASCADE;


--
-- Name: demandcom candidates_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.demandcom
    ADD CONSTRAINT candidates_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);


--
-- Name: master clients_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.master
    ADD CONSTRAINT clients_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);


--
-- Name: clients clients_created_by_fkey1; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clients
    ADD CONSTRAINT clients_created_by_fkey1 FOREIGN KEY (created_by) REFERENCES auth.users(id);


--
-- Name: csbd_projection_audit csbd_projection_audit_changed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.csbd_projection_audit
    ADD CONSTRAINT csbd_projection_audit_changed_by_fkey FOREIGN KEY (changed_by) REFERENCES auth.users(id);


--
-- Name: csbd_projection_audit csbd_projection_audit_projection_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.csbd_projection_audit
    ADD CONSTRAINT csbd_projection_audit_projection_id_fkey FOREIGN KEY (projection_id) REFERENCES public.csbd_projections(id) ON DELETE CASCADE;


--
-- Name: csbd_projection_audit csbd_projection_audit_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.csbd_projection_audit
    ADD CONSTRAINT csbd_projection_audit_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id);


--
-- Name: csbd_projections csbd_projections_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.csbd_projections
    ADD CONSTRAINT csbd_projections_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);


--
-- Name: csbd_projections csbd_projections_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.csbd_projections
    ADD CONSTRAINT csbd_projections_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: csbd_targets csbd_targets_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.csbd_targets
    ADD CONSTRAINT csbd_targets_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);


--
-- Name: csbd_targets csbd_targets_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.csbd_targets
    ADD CONSTRAINT csbd_targets_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: demandcom demandcom_assigned_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.demandcom
    ADD CONSTRAINT demandcom_assigned_by_fkey FOREIGN KEY (assigned_by) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: demandcom demandcom_assigned_to_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.demandcom
    ADD CONSTRAINT demandcom_assigned_to_fkey FOREIGN KEY (assigned_to) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: demandcom_pipeline demandcom_pipeline_demandcom_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.demandcom_pipeline
    ADD CONSTRAINT demandcom_pipeline_demandcom_id_fkey FOREIGN KEY (demandcom_id) REFERENCES public.demandcom(id) ON DELETE CASCADE;


--
-- Name: email_templates email_templates_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_templates
    ADD CONSTRAINT email_templates_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);


--
-- Name: feature_announcements feature_announcements_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.feature_announcements
    ADD CONSTRAINT feature_announcements_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);


--
-- Name: general_tasks general_tasks_assigned_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.general_tasks
    ADD CONSTRAINT general_tasks_assigned_by_fkey FOREIGN KEY (assigned_by) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: general_tasks general_tasks_assigned_to_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.general_tasks
    ADD CONSTRAINT general_tasks_assigned_to_fkey FOREIGN KEY (assigned_to) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: inbound_sms inbound_sms_campaign_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inbound_sms
    ADD CONSTRAINT inbound_sms_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES public.campaigns(id) ON DELETE SET NULL;


--
-- Name: inbound_sms inbound_sms_candidate_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inbound_sms
    ADD CONSTRAINT inbound_sms_candidate_id_fkey FOREIGN KEY (demandcom_id) REFERENCES public.demandcom(id) ON DELETE SET NULL;


--
-- Name: inbound_sms inbound_sms_demandcom_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inbound_sms
    ADD CONSTRAINT inbound_sms_demandcom_id_fkey FOREIGN KEY (demandcom_id) REFERENCES public.demandcom(id) ON DELETE SET NULL;


--
-- Name: inventory_allocations inventory_allocations_allocated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_allocations
    ADD CONSTRAINT inventory_allocations_allocated_by_fkey FOREIGN KEY (allocated_by) REFERENCES public.profiles(id);


--
-- Name: inventory_allocations inventory_allocations_deallocated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_allocations
    ADD CONSTRAINT inventory_allocations_deallocated_by_fkey FOREIGN KEY (deallocated_by) REFERENCES public.profiles(id);


--
-- Name: inventory_allocations inventory_allocations_inventory_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_allocations
    ADD CONSTRAINT inventory_allocations_inventory_item_id_fkey FOREIGN KEY (inventory_item_id) REFERENCES public.inventory_items(id) ON DELETE CASCADE;


--
-- Name: inventory_allocations inventory_allocations_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_allocations
    ADD CONSTRAINT inventory_allocations_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id);


--
-- Name: inventory_audit_log inventory_audit_log_allocation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_audit_log
    ADD CONSTRAINT inventory_audit_log_allocation_id_fkey FOREIGN KEY (allocation_id) REFERENCES public.inventory_allocations(id);


--
-- Name: inventory_audit_log inventory_audit_log_changed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_audit_log
    ADD CONSTRAINT inventory_audit_log_changed_by_fkey FOREIGN KEY (changed_by) REFERENCES public.profiles(id);


--
-- Name: inventory_audit_log inventory_audit_log_inventory_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_audit_log
    ADD CONSTRAINT inventory_audit_log_inventory_item_id_fkey FOREIGN KEY (inventory_item_id) REFERENCES public.inventory_items(id) ON DELETE CASCADE;


--
-- Name: inventory_audit_log inventory_audit_log_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_audit_log
    ADD CONSTRAINT inventory_audit_log_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id);


--
-- Name: inventory_items inventory_items_vendor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_items
    ADD CONSTRAINT inventory_items_vendor_id_fkey FOREIGN KEY (vendor_id) REFERENCES public.vendors(id) ON DELETE SET NULL;


--
-- Name: jobs jobs_client_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.jobs
    ADD CONSTRAINT jobs_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.master(mobile_numb) ON DELETE SET NULL;


--
-- Name: jobs jobs_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.jobs
    ADD CONSTRAINT jobs_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);


--
-- Name: leave_applications leave_applications_approved_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leave_applications
    ADD CONSTRAINT leave_applications_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES auth.users(id);


--
-- Name: leave_applications leave_applications_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leave_applications
    ADD CONSTRAINT leave_applications_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: leave_balances leave_balances_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leave_balances
    ADD CONSTRAINT leave_balances_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: notifications notifications_general_task_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_general_task_id_fkey FOREIGN KEY (general_task_id) REFERENCES public.general_tasks(id) ON DELETE CASCADE;


--
-- Name: notifications notifications_task_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_task_id_fkey FOREIGN KEY (task_id) REFERENCES public.project_tasks(id) ON DELETE CASCADE;


--
-- Name: notifications notifications_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: onboarding_steps onboarding_steps_tour_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.onboarding_steps
    ADD CONSTRAINT onboarding_steps_tour_id_fkey FOREIGN KEY (tour_id) REFERENCES public.onboarding_tours(id) ON DELETE CASCADE;


--
-- Name: profiles profiles_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: profiles profiles_reports_to_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_reports_to_fkey FOREIGN KEY (reports_to) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: project_demandcom_checklist project_demandcom_checklist_assigned_to_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_demandcom_checklist
    ADD CONSTRAINT project_demandcom_checklist_assigned_to_fkey FOREIGN KEY (assigned_to) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: project_demandcom_checklist project_demandcom_checklist_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_demandcom_checklist
    ADD CONSTRAINT project_demandcom_checklist_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: project_digicom_checklist project_digicom_checklist_assigned_to_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_digicom_checklist
    ADD CONSTRAINT project_digicom_checklist_assigned_to_fkey FOREIGN KEY (assigned_to) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: project_digicom_checklist project_digicom_checklist_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_digicom_checklist
    ADD CONSTRAINT project_digicom_checklist_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: project_files project_files_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_files
    ADD CONSTRAINT project_files_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: project_files project_files_uploaded_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_files
    ADD CONSTRAINT project_files_uploaded_by_fkey FOREIGN KEY (uploaded_by) REFERENCES auth.users(id);


--
-- Name: project_livecom_checklist project_livecom_checklist_assigned_to_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_livecom_checklist
    ADD CONSTRAINT project_livecom_checklist_assigned_to_fkey FOREIGN KEY (assigned_to) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: project_livecom_checklist project_livecom_checklist_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_livecom_checklist
    ADD CONSTRAINT project_livecom_checklist_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: project_quotations project_quotations_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_quotations
    ADD CONSTRAINT project_quotations_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);


--
-- Name: project_quotations project_quotations_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_quotations
    ADD CONSTRAINT project_quotations_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: project_tasks project_tasks_assigned_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_tasks
    ADD CONSTRAINT project_tasks_assigned_by_fkey FOREIGN KEY (assigned_by) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: project_tasks project_tasks_assigned_to_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_tasks
    ADD CONSTRAINT project_tasks_assigned_to_fkey FOREIGN KEY (assigned_to) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: project_tasks project_tasks_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_tasks
    ADD CONSTRAINT project_tasks_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: project_team_members project_team_members_assigned_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_team_members
    ADD CONSTRAINT project_team_members_assigned_by_fkey FOREIGN KEY (assigned_by) REFERENCES auth.users(id);


--
-- Name: project_team_members project_team_members_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_team_members
    ADD CONSTRAINT project_team_members_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: project_team_members project_team_members_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_team_members
    ADD CONSTRAINT project_team_members_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id);


--
-- Name: project_team_notifications project_team_notifications_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_team_notifications
    ADD CONSTRAINT project_team_notifications_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: project_team_notifications project_team_notifications_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_team_notifications
    ADD CONSTRAINT project_team_notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: projects projects_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.projects
    ADD CONSTRAINT projects_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);


--
-- Name: sms_templates sms_templates_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sms_templates
    ADD CONSTRAINT sms_templates_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);


--
-- Name: sync_logs sync_logs_sync_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sync_logs
    ADD CONSTRAINT sync_logs_sync_id_fkey FOREIGN KEY (sync_id) REFERENCES public.sync_status(id) ON DELETE CASCADE;


--
-- Name: sync_status sync_status_started_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sync_status
    ADD CONSTRAINT sync_status_started_by_fkey FOREIGN KEY (started_by) REFERENCES auth.users(id);


--
-- Name: team_members team_members_team_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.team_members
    ADD CONSTRAINT team_members_team_id_fkey FOREIGN KEY (team_id) REFERENCES public.teams(id) ON DELETE CASCADE;


--
-- Name: team_members team_members_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.team_members
    ADD CONSTRAINT team_members_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: teams teams_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.teams
    ADD CONSTRAINT teams_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);


--
-- Name: teams teams_team_lead_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.teams
    ADD CONSTRAINT teams_team_lead_id_fkey FOREIGN KEY (team_lead_id) REFERENCES auth.users(id);


--
-- Name: user_announcement_views user_announcement_views_announcement_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_announcement_views
    ADD CONSTRAINT user_announcement_views_announcement_id_fkey FOREIGN KEY (announcement_id) REFERENCES public.feature_announcements(id) ON DELETE CASCADE;


--
-- Name: user_designations user_designations_assigned_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_designations
    ADD CONSTRAINT user_designations_assigned_by_fkey FOREIGN KEY (assigned_by) REFERENCES auth.users(id);


--
-- Name: user_designations user_designations_designation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_designations
    ADD CONSTRAINT user_designations_designation_id_fkey FOREIGN KEY (designation_id) REFERENCES public.designations(id) ON DELETE CASCADE;


--
-- Name: user_designations user_designations_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_designations
    ADD CONSTRAINT user_designations_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: user_onboarding_progress user_onboarding_progress_current_step_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_onboarding_progress
    ADD CONSTRAINT user_onboarding_progress_current_step_id_fkey FOREIGN KEY (current_step_id) REFERENCES public.onboarding_steps(id);


--
-- Name: user_onboarding_progress user_onboarding_progress_tour_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_onboarding_progress
    ADD CONSTRAINT user_onboarding_progress_tour_id_fkey FOREIGN KEY (tour_id) REFERENCES public.onboarding_tours(id) ON DELETE CASCADE;


--
-- Name: user_onboarding_progress user_onboarding_progress_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_onboarding_progress
    ADD CONSTRAINT user_onboarding_progress_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: user_roles user_roles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: webhook_connectors webhook_connectors_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.webhook_connectors
    ADD CONSTRAINT webhook_connectors_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);


--
-- Name: webhook_logs webhook_logs_candidate_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.webhook_logs
    ADD CONSTRAINT webhook_logs_candidate_id_fkey FOREIGN KEY (demandcom_id) REFERENCES public.demandcom(id);


--
-- Name: webhook_logs webhook_logs_demandcom_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.webhook_logs
    ADD CONSTRAINT webhook_logs_demandcom_id_fkey FOREIGN KEY (demandcom_id) REFERENCES public.demandcom(id) ON DELETE SET NULL;


--
-- Name: webhook_logs webhook_logs_job_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.webhook_logs
    ADD CONSTRAINT webhook_logs_job_id_fkey FOREIGN KEY (job_id) REFERENCES public.jobs(id);


--
-- Name: webhook_logs webhook_logs_webhook_connector_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.webhook_logs
    ADD CONSTRAINT webhook_logs_webhook_connector_id_fkey FOREIGN KEY (webhook_connector_id) REFERENCES public.webhook_connectors(id) ON DELETE CASCADE;


--
-- Name: inventory_items Admins and managers can delete inventory items; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins and managers can delete inventory items" ON public.inventory_items FOR DELETE TO authenticated USING ((public.has_role(auth.uid(), 'manager'::public.app_role) OR public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'super_admin'::public.app_role) OR public.has_role(auth.uid(), 'platform_admin'::public.app_role)));


--
-- Name: vendors Admins and managers can delete vendors; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins and managers can delete vendors" ON public.vendors FOR DELETE USING ((public.has_role(auth.uid(), 'manager'::public.app_role) OR public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'super_admin'::public.app_role) OR public.has_role(auth.uid(), 'platform_admin'::public.app_role)));


--
-- Name: inventory_allocations Admins and managers can manage allocations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins and managers can manage allocations" ON public.inventory_allocations USING ((public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'manager'::public.app_role) OR public.has_role(auth.uid(), 'super_admin'::public.app_role) OR public.has_role(auth.uid(), 'platform_admin'::public.app_role)));


--
-- Name: teams Admins can create teams; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can create teams" ON public.teams FOR INSERT TO authenticated WITH CHECK ((public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'super_admin'::public.app_role) OR public.has_role(auth.uid(), 'platform_admin'::public.app_role)));


--
-- Name: demandcom Admins can delete demandcom records; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can delete demandcom records" ON public.demandcom FOR DELETE USING ((public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'super_admin'::public.app_role) OR public.has_role(auth.uid(), 'platform_admin'::public.app_role)));


--
-- Name: email_templates Admins can delete email templates; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can delete email templates" ON public.email_templates FOR DELETE TO authenticated USING ((public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'super_admin'::public.app_role) OR public.has_role(auth.uid(), 'platform_admin'::public.app_role)));


--
-- Name: sms_templates Admins can delete sms templates; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can delete sms templates" ON public.sms_templates FOR DELETE TO authenticated USING ((public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'super_admin'::public.app_role) OR public.has_role(auth.uid(), 'platform_admin'::public.app_role)));


--
-- Name: teams Admins can delete teams; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can delete teams" ON public.teams FOR DELETE TO authenticated USING ((public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'super_admin'::public.app_role) OR public.has_role(auth.uid(), 'platform_admin'::public.app_role)));


--
-- Name: attendance_records Admins can manage all attendance; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage all attendance" ON public.attendance_records USING ((public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'super_admin'::public.app_role) OR public.has_role(auth.uid(), 'platform_admin'::public.app_role) OR public.has_role(auth.uid(), 'admin_administration'::public.app_role)));


--
-- Name: csbd_projections Admins can manage all projections; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage all projections" ON public.csbd_projections TO authenticated USING ((public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'platform_admin'::public.app_role)));


--
-- Name: feature_announcements Admins can manage announcements; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage announcements" ON public.feature_announcements USING ((public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'super_admin'::public.app_role) OR public.has_role(auth.uid(), 'platform_admin'::public.app_role)));


--
-- Name: designations Admins can manage designations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage designations" ON public.designations TO authenticated USING ((public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'super_admin'::public.app_role) OR public.has_role(auth.uid(), 'platform_admin'::public.app_role)));


--
-- Name: call_dispositions Admins can manage dispositions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage dispositions" ON public.call_dispositions TO authenticated USING ((public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'super_admin'::public.app_role) OR public.has_role(auth.uid(), 'platform_admin'::public.app_role)));


--
-- Name: leave_balances Admins can manage leave balances; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage leave balances" ON public.leave_balances USING ((public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'super_admin'::public.app_role) OR public.has_role(auth.uid(), 'platform_admin'::public.app_role) OR public.has_role(auth.uid(), 'admin_administration'::public.app_role)));


--
-- Name: pipeline_stages Admins can manage pipeline stages; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage pipeline stages" ON public.pipeline_stages TO authenticated USING ((public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'super_admin'::public.app_role) OR public.has_role(auth.uid(), 'platform_admin'::public.app_role)));


--
-- Name: attendance_policies Admins can manage policies; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage policies" ON public.attendance_policies USING ((public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'super_admin'::public.app_role) OR public.has_role(auth.uid(), 'platform_admin'::public.app_role) OR public.has_role(auth.uid(), 'admin_administration'::public.app_role)));


--
-- Name: onboarding_steps Admins can manage steps; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage steps" ON public.onboarding_steps TO authenticated USING ((public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'super_admin'::public.app_role) OR public.has_role(auth.uid(), 'platform_admin'::public.app_role)));


--
-- Name: csbd_targets Admins can manage targets; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage targets" ON public.csbd_targets TO authenticated USING ((public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'platform_admin'::public.app_role)));


--
-- Name: onboarding_tours Admins can manage tours; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage tours" ON public.onboarding_tours TO authenticated USING ((public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'super_admin'::public.app_role) OR public.has_role(auth.uid(), 'platform_admin'::public.app_role)));


--
-- Name: user_designations Admins can manage user designations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage user designations" ON public.user_designations TO authenticated USING ((public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'super_admin'::public.app_role) OR public.has_role(auth.uid(), 'platform_admin'::public.app_role)));


--
-- Name: user_announcement_views Admins can view all announcement views; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view all announcement views" ON public.user_announcement_views FOR SELECT USING ((public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'super_admin'::public.app_role) OR public.has_role(auth.uid(), 'platform_admin'::public.app_role)));


--
-- Name: user_onboarding_progress Admins can view all progress; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view all progress" ON public.user_onboarding_progress FOR SELECT TO authenticated USING ((public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'super_admin'::public.app_role) OR public.has_role(auth.uid(), 'platform_admin'::public.app_role)));


--
-- Name: demandcom_backup_swap_20250129 Admins can view backup data; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view backup data" ON public.demandcom_backup_swap_20250129 FOR SELECT USING ((public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'super_admin'::public.app_role) OR public.has_role(auth.uid(), 'platform_admin'::public.app_role)));


--
-- Name: password_reset_logs Admins can view password reset logs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view password reset logs" ON public.password_reset_logs FOR SELECT TO authenticated USING ((public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'super_admin'::public.app_role) OR public.has_role(auth.uid(), 'platform_admin'::public.app_role)));


--
-- Name: clients Authenticated users can create clients; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can create clients" ON public.clients FOR INSERT TO authenticated WITH CHECK ((auth.uid() = created_by));


--
-- Name: general_tasks Authenticated users can create general tasks; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can create general tasks" ON public.general_tasks FOR INSERT WITH CHECK (((auth.uid() IS NOT NULL) AND (auth.uid() = assigned_by)));


--
-- Name: inventory_items Authenticated users can create inventory items; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can create inventory items" ON public.inventory_items FOR INSERT TO authenticated WITH CHECK ((auth.uid() = created_by));


--
-- Name: master Authenticated users can create master records; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can create master records" ON public.master FOR INSERT TO authenticated WITH CHECK ((auth.uid() = created_by));


--
-- Name: vendors Authenticated users can create vendors; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can create vendors" ON public.vendors FOR INSERT WITH CHECK ((auth.uid() = created_by));


--
-- Name: call_logs Authenticated users can insert call logs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can insert call logs" ON public.call_logs FOR INSERT TO authenticated WITH CHECK ((auth.uid() = initiated_by));


--
-- Name: demandcom Authenticated users can update all demandcom records; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can update all demandcom records" ON public.demandcom FOR UPDATE USING (true);


--
-- Name: clients Authenticated users can update clients; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can update clients" ON public.clients FOR UPDATE TO authenticated USING (true);


--
-- Name: inventory_items Authenticated users can update inventory items; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can update inventory items" ON public.inventory_items FOR UPDATE TO authenticated USING (true);


--
-- Name: master Authenticated users can update master records; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can update master records" ON public.master FOR UPDATE TO authenticated USING (true);


--
-- Name: vendors Authenticated users can update vendors; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can update vendors" ON public.vendors FOR UPDATE USING (true);


--
-- Name: onboarding_tours Authenticated users can view active tours; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can view active tours" ON public.onboarding_tours FOR SELECT TO authenticated USING ((is_active = true));


--
-- Name: inventory_audit_log Authenticated users can view audit logs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can view audit logs" ON public.inventory_audit_log FOR SELECT USING (true);


--
-- Name: call_logs Authenticated users can view call logs for accessible demandcom; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can view call logs for accessible demandcom" ON public.call_logs FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.demandcom
  WHERE (demandcom.id = call_logs.demandcom_id))));


--
-- Name: campaign_links Authenticated users can view campaign links; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can view campaign links" ON public.campaign_links FOR SELECT TO authenticated USING (true);


--
-- Name: campaign_recipients Authenticated users can view campaign recipients; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can view campaign recipients" ON public.campaign_recipients FOR SELECT TO authenticated USING (true);


--
-- Name: clients Authenticated users can view clients; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can view clients" ON public.clients FOR SELECT TO authenticated USING (true);


--
-- Name: demandcom_pipeline Authenticated users can view demandcom pipeline; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can view demandcom pipeline" ON public.demandcom_pipeline FOR SELECT USING (true);


--
-- Name: designations Authenticated users can view designations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can view designations" ON public.designations FOR SELECT TO authenticated USING (true);


--
-- Name: call_dispositions Authenticated users can view dispositions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can view dispositions" ON public.call_dispositions FOR SELECT TO authenticated USING (true);


--
-- Name: inbound_sms Authenticated users can view inbound SMS; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can view inbound SMS" ON public.inbound_sms FOR SELECT TO authenticated USING (true);


--
-- Name: inventory_items Authenticated users can view inventory; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can view inventory" ON public.inventory_items FOR SELECT TO authenticated USING (true);


--
-- Name: jobs Authenticated users can view jobs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can view jobs" ON public.jobs FOR SELECT TO authenticated USING (true);


--
-- Name: master Authenticated users can view master; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can view master" ON public.master FOR SELECT TO authenticated USING (true);


--
-- Name: pipeline_stages Authenticated users can view pipeline stages; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can view pipeline stages" ON public.pipeline_stages FOR SELECT TO authenticated USING (true);


--
-- Name: attendance_policies Authenticated users can view policies; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can view policies" ON public.attendance_policies FOR SELECT USING (true);


--
-- Name: role_metadata Authenticated users can view role metadata; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can view role metadata" ON public.role_metadata FOR SELECT TO authenticated USING (true);


--
-- Name: sms_templates Authenticated users can view sms templates; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can view sms templates" ON public.sms_templates FOR SELECT TO authenticated USING (true);


--
-- Name: onboarding_steps Authenticated users can view steps for active tours; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can view steps for active tours" ON public.onboarding_steps FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.onboarding_tours
  WHERE ((onboarding_tours.id = onboarding_steps.tour_id) AND (onboarding_tours.is_active = true)))));


--
-- Name: sync_logs Authenticated users can view sync logs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can view sync logs" ON public.sync_logs FOR SELECT TO authenticated USING (true);


--
-- Name: sync_status Authenticated users can view sync status; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can view sync status" ON public.sync_status FOR SELECT TO authenticated USING (true);


--
-- Name: teams Authenticated users can view teams; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can view teams" ON public.teams FOR SELECT TO authenticated USING (true);


--
-- Name: vendors Authenticated users can view vendors; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can view vendors" ON public.vendors FOR SELECT USING (true);


--
-- Name: webhook_connectors Authenticated users can view webhook connectors; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can view webhook connectors" ON public.webhook_connectors FOR SELECT TO authenticated USING (true);


--
-- Name: webhook_logs Authenticated users can view webhook logs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can view webhook logs" ON public.webhook_logs FOR SELECT TO authenticated USING (true);


--
-- Name: csbd_targets CSBD and leadership can view targets; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "CSBD and leadership can view targets" ON public.csbd_targets FOR SELECT TO authenticated USING ((public.has_role(auth.uid(), 'csbd'::public.app_role) OR public.has_role(auth.uid(), 'leadership'::public.app_role) OR public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'platform_admin'::public.app_role)));


--
-- Name: project_files File uploaders and admins can delete files; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "File uploaders and admins can delete files" ON public.project_files FOR DELETE USING (((auth.uid() = uploaded_by) OR public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'super_admin'::public.app_role) OR public.has_role(auth.uid(), 'platform_admin'::public.app_role)));


--
-- Name: csbd_projection_audit Leadership can view audit logs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Leadership can view audit logs" ON public.csbd_projection_audit FOR SELECT TO authenticated USING ((public.has_role(auth.uid(), 'leadership'::public.app_role) OR public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'platform_admin'::public.app_role)));


--
-- Name: clients Managers and admins can delete clients; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Managers and admins can delete clients" ON public.clients FOR DELETE TO authenticated USING ((public.has_role(auth.uid(), 'manager'::public.app_role) OR public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'super_admin'::public.app_role) OR public.has_role(auth.uid(), 'platform_admin'::public.app_role)));


--
-- Name: master Managers and admins can delete master records; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Managers and admins can delete master records" ON public.master FOR DELETE TO authenticated USING ((public.has_role(auth.uid(), 'manager'::public.app_role) OR public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'super_admin'::public.app_role) OR public.has_role(auth.uid(), 'platform_admin'::public.app_role)));


--
-- Name: leave_applications Managers can approve leaves; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Managers can approve leaves" ON public.leave_applications FOR UPDATE USING ((public.has_role(auth.uid(), 'manager'::public.app_role) OR public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'super_admin'::public.app_role) OR public.has_role(auth.uid(), 'platform_admin'::public.app_role) OR public.has_role(auth.uid(), 'admin_administration'::public.app_role)));


--
-- Name: demandcom Managers can assign demandcom records; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Managers can assign demandcom records" ON public.demandcom FOR UPDATE USING ((public.has_role(auth.uid(), 'manager'::public.app_role) OR public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'super_admin'::public.app_role) OR public.has_role(auth.uid(), 'platform_admin'::public.app_role) OR (auth.uid() = created_by)));


--
-- Name: jobs Managers can manage jobs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Managers can manage jobs" ON public.jobs TO authenticated USING ((public.has_role(auth.uid(), 'manager'::public.app_role) OR public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'super_admin'::public.app_role) OR public.has_role(auth.uid(), 'platform_admin'::public.app_role)));


--
-- Name: projects Project creators and admins can delete projects; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Project creators and admins can delete projects" ON public.projects FOR DELETE USING (((auth.uid() = created_by) OR public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'super_admin'::public.app_role) OR public.has_role(auth.uid(), 'platform_admin'::public.app_role) OR public.has_role(auth.uid(), 'admin_tech'::public.app_role) OR public.has_role(auth.uid(), 'admin_administration'::public.app_role)));


--
-- Name: project_quotations Project creators and admins can manage quotations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Project creators and admins can manage quotations" ON public.project_quotations USING ((EXISTS ( SELECT 1
   FROM public.projects
  WHERE ((projects.id = project_quotations.project_id) AND ((auth.uid() = projects.created_by) OR public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'super_admin'::public.app_role) OR public.has_role(auth.uid(), 'platform_admin'::public.app_role))))));


--
-- Name: project_team_members Project creators and admins can manage team members; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Project creators and admins can manage team members" ON public.project_team_members USING (public.can_access_project(auth.uid(), project_id));


--
-- Name: projects Project creators and admins can update projects; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Project creators and admins can update projects" ON public.projects FOR UPDATE USING (((auth.uid() = created_by) OR public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'super_admin'::public.app_role) OR public.has_role(auth.uid(), 'platform_admin'::public.app_role) OR public.has_role(auth.uid(), 'admin_tech'::public.app_role) OR public.has_role(auth.uid(), 'admin_administration'::public.app_role)));


--
-- Name: project_tasks Project members can create tasks; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Project members can create tasks" ON public.project_tasks FOR INSERT WITH CHECK ((public.can_access_project(auth.uid(), project_id) AND (auth.uid() = assigned_by)));


--
-- Name: project_tasks Project members can delete tasks; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Project members can delete tasks" ON public.project_tasks FOR DELETE USING (((auth.uid() = assigned_by) OR public.can_access_project(auth.uid(), project_id) OR public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'super_admin'::public.app_role) OR public.has_role(auth.uid(), 'platform_admin'::public.app_role)));


--
-- Name: user_roles Super admins and platform admins can manage all roles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Super admins and platform admins can manage all roles" ON public.user_roles TO authenticated USING ((public.has_role(auth.uid(), 'super_admin'::public.app_role) OR public.has_role(auth.uid(), 'platform_admin'::public.app_role)));


--
-- Name: bulk_import_records System can create import records; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "System can create import records" ON public.bulk_import_records FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM public.bulk_import_history
  WHERE ((bulk_import_history.id = bulk_import_records.import_id) AND (bulk_import_history.user_id = auth.uid())))));


--
-- Name: password_reset_logs System can create password reset logs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "System can create password reset logs" ON public.password_reset_logs FOR INSERT TO authenticated WITH CHECK ((auth.uid() = admin_user_id));


--
-- Name: bulk_import_records System can delete import records; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "System can delete import records" ON public.bulk_import_records FOR DELETE USING ((EXISTS ( SELECT 1
   FROM public.bulk_import_history
  WHERE ((bulk_import_history.id = bulk_import_records.import_id) AND (bulk_import_history.user_id = auth.uid())))));


--
-- Name: project_team_notifications System can insert notification records; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "System can insert notification records" ON public.project_team_notifications FOR INSERT WITH CHECK (public.can_access_project(auth.uid(), project_id));


--
-- Name: notifications System can insert notifications; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "System can insert notifications" ON public.notifications FOR INSERT WITH CHECK (true);


--
-- Name: campaign_links System can manage campaign links; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "System can manage campaign links" ON public.campaign_links TO authenticated USING (true);


--
-- Name: campaign_recipients System can manage campaign recipients; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "System can manage campaign recipients" ON public.campaign_recipients TO authenticated USING (true);


--
-- Name: inbound_sms System can manage inbound SMS; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "System can manage inbound SMS" ON public.inbound_sms TO authenticated USING (true);


--
-- Name: sync_logs System can manage sync logs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "System can manage sync logs" ON public.sync_logs TO authenticated USING (true);


--
-- Name: webhook_logs System can manage webhook logs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "System can manage webhook logs" ON public.webhook_logs TO authenticated USING (true);


--
-- Name: call_logs System can update call logs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "System can update call logs" ON public.call_logs FOR UPDATE TO authenticated USING (true);


--
-- Name: team_members Team leads and admins can manage team members; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Team leads and admins can manage team members" ON public.team_members TO authenticated USING (((EXISTS ( SELECT 1
   FROM public.teams
  WHERE ((teams.id = team_members.team_id) AND ((teams.team_lead_id = auth.uid()) OR public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'super_admin'::public.app_role) OR public.has_role(auth.uid(), 'platform_admin'::public.app_role))))) OR public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'super_admin'::public.app_role) OR public.has_role(auth.uid(), 'platform_admin'::public.app_role)));


--
-- Name: teams Team leads and admins can update their teams; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Team leads and admins can update their teams" ON public.teams FOR UPDATE TO authenticated USING (((team_lead_id = auth.uid()) OR public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'super_admin'::public.app_role) OR public.has_role(auth.uid(), 'platform_admin'::public.app_role)));


--
-- Name: leave_applications Users can apply for leave; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can apply for leave" ON public.leave_applications FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: campaigns Users can create campaigns; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create campaigns" ON public.campaigns FOR INSERT TO authenticated WITH CHECK ((auth.uid() = created_by));


--
-- Name: demandcom Users can create demandcom records; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create demandcom records" ON public.demandcom FOR INSERT WITH CHECK ((auth.uid() = created_by));


--
-- Name: email_templates Users can create email templates; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create email templates" ON public.email_templates FOR INSERT TO authenticated WITH CHECK ((auth.uid() = created_by));


--
-- Name: export_jobs Users can create export jobs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create export jobs" ON public.export_jobs FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: bulk_import_history Users can create import history; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create import history" ON public.bulk_import_history FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: projects Users can create projects; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create projects" ON public.projects FOR INSERT WITH CHECK ((auth.uid() = created_by));


--
-- Name: sms_templates Users can create sms templates; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create sms templates" ON public.sms_templates FOR INSERT TO authenticated WITH CHECK ((auth.uid() = created_by));


--
-- Name: sync_status Users can create sync status; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create sync status" ON public.sync_status FOR INSERT TO authenticated WITH CHECK ((auth.uid() = started_by));


--
-- Name: webhook_connectors Users can create webhook connectors; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create webhook connectors" ON public.webhook_connectors FOR INSERT TO authenticated WITH CHECK ((auth.uid() = created_by));


--
-- Name: general_tasks Users can delete their general tasks; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete their general tasks" ON public.general_tasks FOR DELETE USING (((auth.uid() = assigned_by) OR public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'super_admin'::public.app_role) OR public.has_role(auth.uid(), 'platform_admin'::public.app_role)));


--
-- Name: campaigns Users can delete their own campaigns or admins can delete any; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete their own campaigns or admins can delete any" ON public.campaigns FOR DELETE TO authenticated USING (((auth.uid() = created_by) OR public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'super_admin'::public.app_role) OR public.has_role(auth.uid(), 'platform_admin'::public.app_role)));


--
-- Name: webhook_connectors Users can delete their own webhook connectors or admins can del; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete their own webhook connectors or admins can del" ON public.webhook_connectors FOR DELETE TO authenticated USING (((auth.uid() = created_by) OR public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'super_admin'::public.app_role) OR public.has_role(auth.uid(), 'platform_admin'::public.app_role)));


--
-- Name: project_demandcom_checklist Users can insert demandcom checklist for accessible projects; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert demandcom checklist for accessible projects" ON public.project_demandcom_checklist FOR INSERT WITH CHECK (public.can_access_project(auth.uid(), project_id));


--
-- Name: project_digicom_checklist Users can insert digicom checklist for accessible projects; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert digicom checklist for accessible projects" ON public.project_digicom_checklist FOR INSERT WITH CHECK (public.can_access_project(auth.uid(), project_id));


--
-- Name: project_livecom_checklist Users can insert livecom checklist for accessible projects; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert livecom checklist for accessible projects" ON public.project_livecom_checklist FOR INSERT WITH CHECK (public.can_access_project(auth.uid(), project_id));


--
-- Name: user_onboarding_progress Users can insert their own progress; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert their own progress" ON public.user_onboarding_progress FOR INSERT TO authenticated WITH CHECK ((user_id = auth.uid()));


--
-- Name: demandcom_pipeline Users can manage demandcom pipeline; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can manage demandcom pipeline" ON public.demandcom_pipeline USING (true);


--
-- Name: csbd_projections Users can manage their own projections; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can manage their own projections" ON public.csbd_projections TO authenticated USING ((user_id = auth.uid())) WITH CHECK ((user_id = auth.uid()));


--
-- Name: user_announcement_views Users can manage their own views; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can manage their own views" ON public.user_announcement_views USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));


--
-- Name: call_logs Users can set disposition on calls they initiated; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can set disposition on calls they initiated" ON public.call_logs FOR UPDATE TO authenticated USING ((initiated_by = auth.uid())) WITH CHECK ((initiated_by = auth.uid()));


--
-- Name: attendance_records Users can sign in/out; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can sign in/out" ON public.attendance_records FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: project_demandcom_checklist Users can update demandcom checklist for accessible projects; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update demandcom checklist for accessible projects" ON public.project_demandcom_checklist FOR UPDATE USING (public.can_access_project(auth.uid(), project_id));


--
-- Name: demandcom Users can update demandcom records; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update demandcom records" ON public.demandcom FOR UPDATE USING (true);


--
-- Name: project_digicom_checklist Users can update digicom checklist for accessible projects; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update digicom checklist for accessible projects" ON public.project_digicom_checklist FOR UPDATE USING (public.can_access_project(auth.uid(), project_id));


--
-- Name: project_livecom_checklist Users can update livecom checklist for accessible projects; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update livecom checklist for accessible projects" ON public.project_livecom_checklist FOR UPDATE USING (public.can_access_project(auth.uid(), project_id));


--
-- Name: attendance_records Users can update own attendance; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update own attendance" ON public.attendance_records FOR UPDATE USING (((auth.uid() = user_id) AND (date = CURRENT_DATE)));


--
-- Name: notifications Users can update own notifications; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update own notifications" ON public.notifications FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: leave_applications Users can update pending leaves; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update pending leaves" ON public.leave_applications FOR UPDATE USING (((auth.uid() = user_id) AND (status = 'pending'::public.leave_status)));


--
-- Name: project_tasks Users can update their assigned tasks; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their assigned tasks" ON public.project_tasks FOR UPDATE USING (((auth.uid() = assigned_to) OR (auth.uid() = assigned_by) OR public.can_access_project(auth.uid(), project_id) OR public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'super_admin'::public.app_role) OR public.has_role(auth.uid(), 'platform_admin'::public.app_role)));


--
-- Name: campaigns Users can update their campaigns; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their campaigns" ON public.campaigns FOR UPDATE TO authenticated USING ((auth.uid() = created_by));


--
-- Name: email_templates Users can update their email templates; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their email templates" ON public.email_templates FOR UPDATE TO authenticated USING ((auth.uid() = created_by));


--
-- Name: general_tasks Users can update their general tasks; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their general tasks" ON public.general_tasks FOR UPDATE USING (((auth.uid() = assigned_to) OR (auth.uid() = assigned_by) OR public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'super_admin'::public.app_role) OR public.has_role(auth.uid(), 'platform_admin'::public.app_role)));


--
-- Name: bulk_import_history Users can update their own import history; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their own import history" ON public.bulk_import_history FOR UPDATE USING (((auth.uid() = user_id) OR public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'super_admin'::public.app_role) OR public.has_role(auth.uid(), 'platform_admin'::public.app_role)));


--
-- Name: profiles Users can update their own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE USING ((auth.uid() = id));


--
-- Name: user_onboarding_progress Users can update their own progress; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their own progress" ON public.user_onboarding_progress FOR UPDATE TO authenticated USING ((user_id = auth.uid()));


--
-- Name: sms_templates Users can update their sms templates; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their sms templates" ON public.sms_templates FOR UPDATE TO authenticated USING ((auth.uid() = created_by));


--
-- Name: sync_status Users can update their sync status; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their sync status" ON public.sync_status FOR UPDATE TO authenticated USING ((auth.uid() = started_by));


--
-- Name: webhook_connectors Users can update their webhook connectors; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their webhook connectors" ON public.webhook_connectors FOR UPDATE TO authenticated USING ((auth.uid() = created_by));


--
-- Name: project_files Users can upload files to accessible projects; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can upload files to accessible projects" ON public.project_files FOR INSERT WITH CHECK (public.can_access_project(auth.uid(), project_id));


--
-- Name: feature_announcements Users can view active announcements; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view active announcements" ON public.feature_announcements FOR SELECT USING ((is_active = true));


--
-- Name: demandcom Users can view assigned demandcom records; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view assigned demandcom records" ON public.demandcom FOR SELECT USING (((auth.uid() = assigned_to) OR (auth.uid() = created_by) OR public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'super_admin'::public.app_role) OR public.has_role(auth.uid(), 'platform_admin'::public.app_role)));


--
-- Name: campaigns Users can view campaigns based on hierarchy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view campaigns based on hierarchy" ON public.campaigns FOR SELECT TO authenticated USING ((public.can_access_user(auth.uid(), created_by) OR public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'super_admin'::public.app_role) OR public.has_role(auth.uid(), 'platform_admin'::public.app_role)));


--
-- Name: demandcom Users can view demandcom based on assignment and hierarchy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view demandcom based on assignment and hierarchy" ON public.demandcom FOR SELECT TO authenticated USING (((assigned_to = auth.uid()) OR ((assigned_to IS NOT NULL) AND public.can_access_user(auth.uid(), assigned_to)) OR (created_by = auth.uid()) OR public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'super_admin'::public.app_role) OR public.has_role(auth.uid(), 'platform_admin'::public.app_role) OR public.has_role(auth.uid(), 'admin_administration'::public.app_role) OR public.has_role(auth.uid(), 'admin_tech'::public.app_role)));


--
-- Name: project_demandcom_checklist Users can view demandcom checklist for accessible projects; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view demandcom checklist for accessible projects" ON public.project_demandcom_checklist FOR SELECT USING (public.can_access_project(auth.uid(), project_id));


--
-- Name: user_designations Users can view designations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view designations" ON public.user_designations FOR SELECT TO authenticated USING (true);


--
-- Name: project_digicom_checklist Users can view digicom checklist for accessible projects; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view digicom checklist for accessible projects" ON public.project_digicom_checklist FOR SELECT USING (public.can_access_project(auth.uid(), project_id));


--
-- Name: project_files Users can view files for accessible projects; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view files for accessible projects" ON public.project_files FOR SELECT USING (public.can_access_project(auth.uid(), project_id));


--
-- Name: project_livecom_checklist Users can view livecom checklist for accessible projects; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view livecom checklist for accessible projects" ON public.project_livecom_checklist FOR SELECT USING (public.can_access_project(auth.uid(), project_id));


--
-- Name: project_team_notifications Users can view notifications for accessible projects; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view notifications for accessible projects" ON public.project_team_notifications FOR SELECT USING (public.can_access_project(auth.uid(), project_id));


--
-- Name: attendance_records Users can view own attendance; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own attendance" ON public.attendance_records FOR SELECT USING (((auth.uid() = user_id) OR public.can_access_user(auth.uid(), user_id)));


--
-- Name: export_jobs Users can view own export jobs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own export jobs" ON public.export_jobs FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: leave_balances Users can view own leave balance; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own leave balance" ON public.leave_balances FOR SELECT USING (((auth.uid() = user_id) OR public.can_access_user(auth.uid(), user_id)));


--
-- Name: leave_applications Users can view own leaves; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own leaves" ON public.leave_applications FOR SELECT USING (((auth.uid() = user_id) OR public.can_access_user(auth.uid(), user_id)));


--
-- Name: notifications Users can view own notifications; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own notifications" ON public.notifications FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: profiles Users can view profiles based on hierarchy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view profiles based on hierarchy" ON public.profiles FOR SELECT USING (public.can_access_user(auth.uid(), id));


--
-- Name: projects Users can view projects they created or are team members of; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view projects they created or are team members of" ON public.projects FOR SELECT USING (((auth.uid() = created_by) OR public.is_project_team_member(auth.uid(), id) OR public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'super_admin'::public.app_role) OR public.has_role(auth.uid(), 'platform_admin'::public.app_role) OR public.has_role(auth.uid(), 'admin_tech'::public.app_role) OR public.has_role(auth.uid(), 'admin_administration'::public.app_role)));


--
-- Name: project_quotations Users can view quotations for accessible projects; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view quotations for accessible projects" ON public.project_quotations FOR SELECT USING (public.can_access_project(auth.uid(), project_id));


--
-- Name: project_team_members Users can view team members for accessible projects; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view team members for accessible projects" ON public.project_team_members FOR SELECT USING (public.can_access_project(auth.uid(), project_id));


--
-- Name: email_templates Users can view templates based on hierarchy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view templates based on hierarchy" ON public.email_templates FOR SELECT TO authenticated USING ((public.can_access_user(auth.uid(), created_by) OR public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'super_admin'::public.app_role) OR public.has_role(auth.uid(), 'platform_admin'::public.app_role)));


--
-- Name: project_tasks Users can view their assigned tasks or tasks in their projects; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their assigned tasks or tasks in their projects" ON public.project_tasks FOR SELECT USING (((auth.uid() = assigned_to) OR (auth.uid() = assigned_by) OR public.can_access_project(auth.uid(), project_id) OR public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'super_admin'::public.app_role) OR public.has_role(auth.uid(), 'platform_admin'::public.app_role) OR public.has_role(auth.uid(), 'admin_tech'::public.app_role) OR public.has_role(auth.uid(), 'admin_administration'::public.app_role)));


--
-- Name: general_tasks Users can view their general tasks; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their general tasks" ON public.general_tasks FOR SELECT USING (((auth.uid() = assigned_to) OR (auth.uid() = assigned_by) OR public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'super_admin'::public.app_role) OR public.has_role(auth.uid(), 'platform_admin'::public.app_role)));


--
-- Name: inventory_allocations Users can view their own allocations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own allocations" ON public.inventory_allocations FOR SELECT USING (((auth.uid() = user_id) OR public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'manager'::public.app_role) OR public.has_role(auth.uid(), 'super_admin'::public.app_role) OR public.has_role(auth.uid(), 'platform_admin'::public.app_role)));


--
-- Name: bulk_import_history Users can view their own import history; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own import history" ON public.bulk_import_history FOR SELECT USING (((auth.uid() = user_id) OR public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'super_admin'::public.app_role) OR public.has_role(auth.uid(), 'platform_admin'::public.app_role)));


--
-- Name: bulk_import_records Users can view their own import records; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own import records" ON public.bulk_import_records FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.bulk_import_history
  WHERE ((bulk_import_history.id = bulk_import_records.import_id) AND ((bulk_import_history.user_id = auth.uid()) OR public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'super_admin'::public.app_role) OR public.has_role(auth.uid(), 'platform_admin'::public.app_role))))));


--
-- Name: user_onboarding_progress Users can view their own progress; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own progress" ON public.user_onboarding_progress FOR SELECT TO authenticated USING ((user_id = auth.uid()));


--
-- Name: csbd_projections Users can view their own projections; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own projections" ON public.csbd_projections FOR SELECT TO authenticated USING (((user_id = auth.uid()) OR (EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.reports_to = auth.uid()) AND (profiles.id = csbd_projections.user_id)))) OR public.has_role(auth.uid(), 'csbd'::public.app_role) OR public.has_role(auth.uid(), 'leadership'::public.app_role) OR public.has_role(auth.uid(), 'admin'::public.app_role)));


--
-- Name: user_roles Users can view their own roles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own roles" ON public.user_roles FOR SELECT USING (((auth.uid() = user_id) OR public.has_role(auth.uid(), 'platform_admin'::public.app_role) OR public.has_role(auth.uid(), 'super_admin'::public.app_role) OR public.has_role(auth.uid(), 'admin_administration'::public.app_role) OR public.has_role(auth.uid(), 'admin_tech'::public.app_role) OR public.has_role(auth.uid(), 'admin'::public.app_role)));


--
-- Name: team_members Users can view their team memberships; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their team memberships" ON public.team_members FOR SELECT USING (((user_id = auth.uid()) OR public.has_role(auth.uid(), 'platform_admin'::public.app_role) OR public.has_role(auth.uid(), 'super_admin'::public.app_role) OR public.has_role(auth.uid(), 'admin_administration'::public.app_role) OR public.has_role(auth.uid(), 'admin_tech'::public.app_role) OR public.has_role(auth.uid(), 'admin'::public.app_role)));


--
-- Name: attendance_policies; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.attendance_policies ENABLE ROW LEVEL SECURITY;

--
-- Name: attendance_records; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.attendance_records ENABLE ROW LEVEL SECURITY;

--
-- Name: bulk_import_history; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.bulk_import_history ENABLE ROW LEVEL SECURITY;

--
-- Name: bulk_import_records; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.bulk_import_records ENABLE ROW LEVEL SECURITY;

--
-- Name: call_dispositions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.call_dispositions ENABLE ROW LEVEL SECURITY;

--
-- Name: call_logs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.call_logs ENABLE ROW LEVEL SECURITY;

--
-- Name: campaign_links; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.campaign_links ENABLE ROW LEVEL SECURITY;

--
-- Name: campaign_recipients; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.campaign_recipients ENABLE ROW LEVEL SECURITY;

--
-- Name: campaigns; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;

--
-- Name: clients; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

--
-- Name: csbd_projection_audit; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.csbd_projection_audit ENABLE ROW LEVEL SECURITY;

--
-- Name: csbd_projections; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.csbd_projections ENABLE ROW LEVEL SECURITY;

--
-- Name: csbd_targets; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.csbd_targets ENABLE ROW LEVEL SECURITY;

--
-- Name: demandcom; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.demandcom ENABLE ROW LEVEL SECURITY;

--
-- Name: demandcom_backup_swap_20250129; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.demandcom_backup_swap_20250129 ENABLE ROW LEVEL SECURITY;

--
-- Name: demandcom_pipeline; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.demandcom_pipeline ENABLE ROW LEVEL SECURITY;

--
-- Name: designations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.designations ENABLE ROW LEVEL SECURITY;

--
-- Name: email_templates; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;

--
-- Name: export_jobs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.export_jobs ENABLE ROW LEVEL SECURITY;

--
-- Name: feature_announcements; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.feature_announcements ENABLE ROW LEVEL SECURITY;

--
-- Name: general_tasks; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.general_tasks ENABLE ROW LEVEL SECURITY;

--
-- Name: inbound_sms; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.inbound_sms ENABLE ROW LEVEL SECURITY;

--
-- Name: inventory_allocations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.inventory_allocations ENABLE ROW LEVEL SECURITY;

--
-- Name: inventory_audit_log; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.inventory_audit_log ENABLE ROW LEVEL SECURITY;

--
-- Name: inventory_items; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.inventory_items ENABLE ROW LEVEL SECURITY;

--
-- Name: jobs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;

--
-- Name: leave_applications; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.leave_applications ENABLE ROW LEVEL SECURITY;

--
-- Name: leave_balances; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.leave_balances ENABLE ROW LEVEL SECURITY;

--
-- Name: master; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.master ENABLE ROW LEVEL SECURITY;

--
-- Name: notifications; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

--
-- Name: onboarding_steps; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.onboarding_steps ENABLE ROW LEVEL SECURITY;

--
-- Name: onboarding_tours; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.onboarding_tours ENABLE ROW LEVEL SECURITY;

--
-- Name: password_reset_logs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.password_reset_logs ENABLE ROW LEVEL SECURITY;

--
-- Name: pipeline_stages; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.pipeline_stages ENABLE ROW LEVEL SECURITY;

--
-- Name: profiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: project_demandcom_checklist; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.project_demandcom_checklist ENABLE ROW LEVEL SECURITY;

--
-- Name: project_digicom_checklist; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.project_digicom_checklist ENABLE ROW LEVEL SECURITY;

--
-- Name: project_files; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.project_files ENABLE ROW LEVEL SECURITY;

--
-- Name: project_livecom_checklist; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.project_livecom_checklist ENABLE ROW LEVEL SECURITY;

--
-- Name: project_quotations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.project_quotations ENABLE ROW LEVEL SECURITY;

--
-- Name: project_tasks; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.project_tasks ENABLE ROW LEVEL SECURITY;

--
-- Name: project_team_members; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.project_team_members ENABLE ROW LEVEL SECURITY;

--
-- Name: project_team_notifications; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.project_team_notifications ENABLE ROW LEVEL SECURITY;

--
-- Name: projects; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

--
-- Name: role_metadata; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.role_metadata ENABLE ROW LEVEL SECURITY;

--
-- Name: sms_templates; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.sms_templates ENABLE ROW LEVEL SECURITY;

--
-- Name: sync_logs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.sync_logs ENABLE ROW LEVEL SECURITY;

--
-- Name: sync_status; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.sync_status ENABLE ROW LEVEL SECURITY;

--
-- Name: team_members; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;

--
-- Name: teams; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;

--
-- Name: user_announcement_views; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_announcement_views ENABLE ROW LEVEL SECURITY;

--
-- Name: user_designations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_designations ENABLE ROW LEVEL SECURITY;

--
-- Name: user_onboarding_progress; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_onboarding_progress ENABLE ROW LEVEL SECURITY;

--
-- Name: user_roles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

--
-- Name: vendors; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.vendors ENABLE ROW LEVEL SECURITY;

--
-- Name: webhook_connectors; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.webhook_connectors ENABLE ROW LEVEL SECURITY;

--
-- Name: webhook_logs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.webhook_logs ENABLE ROW LEVEL SECURITY;

--
-- PostgreSQL database dump complete
--


