-- TrashDrop Request Management System - Database Migrations
-- Run these migrations in your Supabase SQL editor

-- 1. Add new columns to pickup_requests table for reservation management
ALTER TABLE public.pickup_requests ADD COLUMN IF NOT EXISTS 
  reserved_by uuid REFERENCES auth.users(id),
  reserved_at timestamp with time zone,
  reserved_until timestamp with time zone,
  exclusion_until timestamp with time zone,
  assignment_expires_at timestamp with time zone,
  filter_criteria jsonb,
  last_pool_entry timestamp with time zone DEFAULT now();

-- 2. Create collector_sessions table for session management
CREATE TABLE IF NOT EXISTS public.collector_sessions (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  collector_id uuid NOT NULL REFERENCES auth.users(id),
  filter_criteria jsonb,
  reserved_requests uuid[] DEFAULT ARRAY[]::uuid[],
  session_start timestamp with time zone DEFAULT now(),
  last_activity timestamp with time zone DEFAULT now(),
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT collector_sessions_collector_id_key UNIQUE (collector_id)
);

-- 3. Create request_notifications table for real-time updates
CREATE TABLE IF NOT EXISTS public.request_notifications (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  collector_id uuid NOT NULL REFERENCES auth.users(id),
  request_id uuid REFERENCES public.pickup_requests(id),
  notification_type text NOT NULL CHECK (notification_type = ANY (ARRAY['request_unavailable', 'assignment_expired', 'reservation_expired'])),
  message text NOT NULL,
  read_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now()
);

-- 4. Create indexes for performance optimization
CREATE INDEX IF NOT EXISTS idx_pickup_requests_status_reserved ON public.pickup_requests(status, reserved_by) WHERE reserved_by IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_pickup_requests_reserved_until ON public.pickup_requests(reserved_until) WHERE reserved_until IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_pickup_requests_assignment_expires ON public.pickup_requests(assignment_expires_at) WHERE assignment_expires_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_pickup_requests_exclusion_until ON public.pickup_requests(exclusion_until) WHERE exclusion_until IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_collector_sessions_active ON public.collector_sessions(collector_id, is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_request_notifications_collector ON public.request_notifications(collector_id, read_at);

-- 5. Enable Row Level Security (RLS) policies
ALTER TABLE public.collector_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.request_notifications ENABLE ROW LEVEL SECURITY;

-- 6. Create RLS policies for collector_sessions
CREATE POLICY "Collectors can view their own sessions"
  ON public.collector_sessions FOR SELECT
  TO authenticated
  USING (collector_id = auth.uid());

CREATE POLICY "Collectors can update their own sessions"
  ON public.collector_sessions FOR UPDATE
  TO authenticated
  USING (collector_id = auth.uid());

CREATE POLICY "Collectors can insert their own sessions"
  ON public.collector_sessions FOR INSERT
  TO authenticated
  WITH CHECK (collector_id = auth.uid());

-- 7. Create RLS policies for request_notifications
CREATE POLICY "Collectors can view their own notifications"
  ON public.request_notifications FOR SELECT
  TO authenticated
  USING (collector_id = auth.uid());

CREATE POLICY "System can insert notifications for any collector"
  ON public.request_notifications FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Collectors can update their own notifications"
  ON public.request_notifications FOR UPDATE
  TO authenticated
  USING (collector_id = auth.uid());

-- 8. Create functions for automatic cleanup
CREATE OR REPLACE FUNCTION cleanup_expired_reservations()
RETURNS void AS $$
BEGIN
  UPDATE public.pickup_requests
  SET 
    reserved_by = NULL,
    reserved_at = NULL,
    reserved_until = NULL,
    updated_at = now()
  WHERE 
    reserved_by IS NOT NULL 
    AND reserved_until < now();
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION cleanup_expired_assignments()
RETURNS void AS $$
BEGIN
  UPDATE public.pickup_requests
  SET 
    status = 'available',
    collector_id = NULL,
    accepted_at = NULL,
    assignment_expires_at = NULL,
    exclusion_until = now() + interval '5 minutes',
    last_pool_entry = now(),
    updated_at = now()
  WHERE 
    status = 'accepted' 
    AND assignment_expires_at < now();
END;
$$ LANGUAGE plpgsql;

-- 9. Create function to handle request state changes
CREATE OR REPLACE FUNCTION notify_request_state_change()
RETURNS trigger AS $$
BEGIN
  -- If request was accepted, notify other collectors who had it reserved
  IF NEW.status = 'accepted' AND OLD.status != 'accepted' THEN
    INSERT INTO public.request_notifications (collector_id, request_id, notification_type, message)
    SELECT 
      cs.collector_id,
      NEW.id,
      'request_unavailable',
      'A request you were viewing has been accepted by another collector'
    FROM public.collector_sessions cs
    WHERE cs.collector_id != NEW.collector_id
      AND NEW.id = ANY(cs.reserved_requests)
      AND cs.is_active = true;
      
    -- Clear the request from other collectors' reserved lists
    UPDATE public.collector_sessions
    SET reserved_requests = array_remove(reserved_requests, NEW.id)
    WHERE collector_id != NEW.collector_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 10. Create trigger for request state changes
DROP TRIGGER IF EXISTS request_state_change_trigger ON public.pickup_requests;
CREATE TRIGGER request_state_change_trigger
  AFTER UPDATE ON public.pickup_requests
  FOR EACH ROW
  EXECUTE FUNCTION notify_request_state_change();

-- 11. Create function to cleanup inactive sessions
CREATE OR REPLACE FUNCTION cleanup_inactive_sessions()
RETURNS void AS $$
BEGIN
  UPDATE public.collector_sessions
  SET 
    is_active = false,
    updated_at = now()
  WHERE 
    is_active = true 
    AND last_activity < now() - interval '10 minutes';
END;
$$ LANGUAGE plpgsql;

-- 12. Grant necessary permissions
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON public.collector_sessions TO authenticated;
GRANT ALL ON public.request_notifications TO authenticated;
GRANT SELECT, UPDATE ON public.pickup_requests TO authenticated;
