-- TrashDrop Status Management System - Database Migrations
-- Run these migrations in your Supabase SQL editor

-- 1. Add status columns to existing collector_sessions table (if not already exists)
ALTER TABLE public.collector_sessions ADD COLUMN IF NOT EXISTS 
  status text DEFAULT 'offline' CHECK (status IN ('online', 'offline', 'busy', 'break')),
  status_reason text,
  last_status_change timestamp with time zone DEFAULT now();

-- 2. Create collector_status_history table for tracking status changes
CREATE TABLE IF NOT EXISTS public.collector_status_history (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  collector_id uuid NOT NULL REFERENCES auth.users(id),
  status text NOT NULL CHECK (status IN ('online', 'offline', 'busy', 'break')),
  status_reason text,
  session_start timestamp with time zone,
  session_end timestamp with time zone,
  session_duration integer, -- in seconds
  requests_accepted integer DEFAULT 0,
  requests_completed integer DEFAULT 0,
  location_lat decimal(10, 8),
  location_lng decimal(11, 8),
  created_at timestamp with time zone DEFAULT now()
);

-- 3. Create indexes for performance optimization
CREATE INDEX IF NOT EXISTS idx_collector_status_history_collector ON public.collector_status_history(collector_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_collector_status_history_status ON public.collector_status_history(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_collector_sessions_status ON public.collector_sessions(status, last_status_change);

-- 4. Enable Row Level Security (RLS) policies
ALTER TABLE public.collector_status_history ENABLE ROW LEVEL SECURITY;

-- 5. Create RLS policies for collector_status_history
CREATE POLICY "Collectors can view their own status history"
  ON public.collector_status_history FOR SELECT
  TO authenticated
  USING (collector_id = auth.uid());

CREATE POLICY "Collectors can insert their own status history"
  ON public.collector_status_history FOR INSERT
  TO authenticated
  WITH CHECK (collector_id = auth.uid());

-- 6. Create function to automatically update collector session status
CREATE OR REPLACE FUNCTION update_collector_session_status()
RETURNS trigger AS $$
BEGIN
  -- Update the collector_sessions table when status changes
  UPDATE public.collector_sessions
  SET 
    status = NEW.status,
    status_reason = NEW.status_reason,
    last_status_change = NEW.created_at,
    is_active = (NEW.status = 'online'),
    last_activity = now(),
    updated_at = now()
  WHERE collector_id = NEW.collector_id;
  
  -- If no session exists, create one
  IF NOT FOUND THEN
    INSERT INTO public.collector_sessions (
      collector_id,
      status,
      status_reason,
      last_status_change,
      is_active,
      last_activity,
      created_at,
      updated_at
    ) VALUES (
      NEW.collector_id,
      NEW.status,
      NEW.status_reason,
      NEW.created_at,
      (NEW.status = 'online'),
      now(),
      now(),
      now()
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 7. Create trigger to automatically update session on status history insert
DROP TRIGGER IF EXISTS update_session_on_status_change ON public.collector_status_history;
CREATE TRIGGER update_session_on_status_change
  AFTER INSERT ON public.collector_status_history
  FOR EACH ROW
  EXECUTE FUNCTION update_collector_session_status();

-- 8. Create function to get active online collectors
CREATE OR REPLACE FUNCTION get_active_online_collectors()
RETURNS TABLE(collector_id uuid, status text, last_status_change timestamp with time zone) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    cs.collector_id,
    cs.status,
    cs.last_status_change
  FROM public.collector_sessions cs
  WHERE cs.status = 'online'
    AND cs.is_active = true
    AND cs.last_activity > (now() - interval '10 minutes')
  ORDER BY cs.last_status_change DESC;
END;
$$ LANGUAGE plpgsql;

-- 9. Create function to cleanup stale sessions
CREATE OR REPLACE FUNCTION cleanup_stale_collector_sessions()
RETURNS void AS $$
BEGIN
  -- Mark sessions as inactive if no activity for 10 minutes
  UPDATE public.collector_sessions
  SET 
    status = 'offline',
    is_active = false,
    status_reason = 'Auto-offline (inactive)',
    last_status_change = now(),
    updated_at = now()
  WHERE 
    status != 'offline' 
    AND is_active = true 
    AND last_activity < (now() - interval '10 minutes');
    
  -- Log the cleanup to status history
  INSERT INTO public.collector_status_history (
    collector_id,
    status,
    status_reason,
    created_at
  )
  SELECT 
    collector_id,
    'offline',
    'Auto-offline (inactive)',
    now()
  FROM public.collector_sessions
  WHERE 
    status = 'offline' 
    AND status_reason = 'Auto-offline (inactive)'
    AND last_status_change = now();
    
  GET DIAGNOSTICS ROW_COUNT;
  RAISE NOTICE 'Cleaned up % stale collector sessions', ROW_COUNT;
END;
$$ LANGUAGE plpgsql;

-- 10. Grant necessary permissions
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON public.collector_status_history TO authenticated;
GRANT SELECT, UPDATE ON public.collector_sessions TO authenticated;

-- 11. Insert some sample status data for testing (optional - remove in production)
DO $$
DECLARE
    test_user_id uuid;
BEGIN
    -- Get the first authenticated user for testing
    SELECT id INTO test_user_id FROM auth.users LIMIT 1;
    
    -- Only insert if we found a user
    IF test_user_id IS NOT NULL THEN
        INSERT INTO public.collector_status_history (
            collector_id,
            status,
            status_reason,
            session_start,
            session_end,
            session_duration,
            requests_accepted,
            requests_completed
        ) VALUES 
        (test_user_id, 'online', 'Started shift', now() - interval '2 hours', now() - interval '1 hour', 3600, 5, 3),
        (test_user_id, 'break', 'Lunch break', now() - interval '1 hour', now() - interval '30 minutes', 1800, 0, 0),
        (test_user_id, 'online', 'Back from break', now() - interval '30 minutes', now(), 1800, 2, 2)
        ON CONFLICT DO NOTHING;
        
        RAISE NOTICE 'Sample status data inserted for user: %', test_user_id;
    ELSE
        RAISE NOTICE 'No users found, skipping sample data insertion';
    END IF;
END $$;
