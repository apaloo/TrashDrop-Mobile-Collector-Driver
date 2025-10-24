-- TrashDrop Request Management System - Database Migrations
-- Run these migrations in your Supabase SQL editor

-- 1. Drop all dependent constraints first
DO $$ 
BEGIN
  -- Drop dependent foreign keys
  IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'fee_points_request_id_fkey') THEN
    ALTER TABLE public.fee_points DROP CONSTRAINT fee_points_request_id_fkey;
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'bags_batch_id_fkey') THEN
    ALTER TABLE public.bags DROP CONSTRAINT bags_batch_id_fkey;
  END IF;
  
  -- Drop pickup_requests constraints
  IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'pickup_requests_pkey') THEN
    ALTER TABLE public.pickup_requests DROP CONSTRAINT pickup_requests_pkey;
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'pickup_requests_id_fkey') THEN
    ALTER TABLE public.pickup_requests DROP CONSTRAINT pickup_requests_id_fkey;
  END IF;

  -- Move UUIDs from id.. to id column
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'pickup_requests' AND column_name = 'id..') THEN
    -- Drop id column if it exists (it's NULL anyway)
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'pickup_requests' AND column_name = 'id') THEN
      ALTER TABLE public.pickup_requests DROP COLUMN id;
    END IF;

    -- Rename id.. to id
    ALTER TABLE public.pickup_requests RENAME COLUMN "id.." TO id;
    RAISE NOTICE 'Moved UUIDs from id.. to id column';
  END IF;
END $$;

-- 2. Ensure pickup_requests table exists with correct schema
DO $$ 
BEGIN
  -- Create table if it doesn't exist
  CREATE TABLE IF NOT EXISTS public.pickup_requests (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    waste_type VARCHAR NOT NULL,
    coordinates FLOAT[] NOT NULL,
    location VARCHAR NOT NULL,
    fee INTEGER NOT NULL,
    status VARCHAR DEFAULT 'available',
    priority VARCHAR DEFAULT 'medium',
    bag_count INTEGER DEFAULT 1,
    special_instructions TEXT,
    created_at TIMESTAMP DEFAULT now(),
    updated_at TIMESTAMP DEFAULT now()
  );

  -- Convert existing id column to UUID if needed
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'pickup_requests'
    AND column_name = 'id'
    AND data_type != 'uuid'
  ) THEN
    -- Fix malformed UUIDs first
    UPDATE public.pickup_requests
    SET id = gen_random_uuid()::text
    WHERE id IS NOT NULL 
      AND id !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';

    -- Convert to UUID
    ALTER TABLE public.pickup_requests ALTER COLUMN id TYPE uuid USING id::uuid;
    ALTER TABLE public.pickup_requests ALTER COLUMN id SET DEFAULT gen_random_uuid();
  END IF;

  -- Fix NULL ids
  UPDATE public.pickup_requests SET id = gen_random_uuid() WHERE id IS NULL;
END $$;

-- 3. Re-add constraints and foreign keys
DO $$ 
BEGIN
  -- Add foreign key to rewards if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'pickup_requests_id_fkey'
  ) THEN
    ALTER TABLE public.pickup_requests ADD CONSTRAINT pickup_requests_id_fkey FOREIGN KEY (id) REFERENCES public.rewards(id);
  END IF;
  
  -- Re-add dependent foreign key constraints
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fee_points_request_id_fkey'
  ) THEN
    ALTER TABLE public.fee_points ADD CONSTRAINT fee_points_request_id_fkey FOREIGN KEY (request_id) REFERENCES public.pickup_requests(id);
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'bags_batch_id_fkey'
  ) THEN
    ALTER TABLE public.bags ADD CONSTRAINT bags_batch_id_fkey FOREIGN KEY (batch_id) REFERENCES public.pickup_requests(id);
  END IF;
END $$;

-- 4. Add new columns to pickup_requests table for reservation management
ALTER TABLE public.pickup_requests 
  ADD COLUMN IF NOT EXISTS reserved_by uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS reserved_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS reserved_until timestamp with time zone,
  ADD COLUMN IF NOT EXISTS exclusion_until timestamp with time zone,
  ADD COLUMN IF NOT EXISTS assignment_expires_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS filter_criteria jsonb,
  ADD COLUMN IF NOT EXISTS last_pool_entry timestamp with time zone DEFAULT now();

-- 5. Create collector_sessions table for session management
DO $$ 
BEGIN
  -- Drop existing table if it exists to ensure clean state
  DROP TABLE IF EXISTS public.collector_sessions;

  -- Create table with proper schema
  CREATE TABLE public.collector_sessions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    collector_id uuid NOT NULL REFERENCES auth.users(id),
    filter_criteria jsonb,
    reserved_requests uuid[] DEFAULT ARRAY[]::uuid[],
    session_start timestamp with time zone DEFAULT now(),
    last_activity timestamp with time zone DEFAULT now(),
    is_active boolean DEFAULT true,
    expires_at timestamp with time zone DEFAULT (now() + interval '24 hours')
  );

  -- Add indexes for performance
  CREATE INDEX IF NOT EXISTS idx_collector_sessions_collector_id ON public.collector_sessions(collector_id);
  CREATE INDEX IF NOT EXISTS idx_collector_sessions_is_active ON public.collector_sessions(is_active);
  CREATE INDEX IF NOT EXISTS idx_collector_sessions_expires_at ON public.collector_sessions(expires_at);

  -- Add RLS policies
  ALTER TABLE public.collector_sessions ENABLE ROW LEVEL SECURITY;

  -- Allow collectors to view and manage their own sessions
  CREATE POLICY manage_own_sessions ON public.collector_sessions
    FOR ALL
    TO authenticated
    USING (collector_id = auth.uid());
END $$;

-- 6. Create indexes on pickup_requests for performance
DO $$ 
BEGIN
  -- Indexes for status and reservation management
  CREATE INDEX IF NOT EXISTS idx_pickup_requests_status ON public.pickup_requests(status);
  CREATE INDEX IF NOT EXISTS idx_pickup_requests_reserved_by ON public.pickup_requests(reserved_by);
  CREATE INDEX IF NOT EXISTS idx_pickup_requests_reserved_until ON public.pickup_requests(reserved_until);
  CREATE INDEX IF NOT EXISTS idx_pickup_requests_exclusion_until ON public.pickup_requests(exclusion_until);
  CREATE INDEX IF NOT EXISTS idx_pickup_requests_assignment_expires_at ON public.pickup_requests(assignment_expires_at);

  -- Indexes for filtering and sorting
  CREATE INDEX IF NOT EXISTS idx_pickup_requests_waste_type ON public.pickup_requests(waste_type);
  CREATE INDEX IF NOT EXISTS idx_pickup_requests_priority ON public.pickup_requests(priority);
  CREATE INDEX IF NOT EXISTS idx_pickup_requests_fee ON public.pickup_requests(fee);
  CREATE INDEX IF NOT EXISTS idx_pickup_requests_created_at ON public.pickup_requests(created_at);
END $$;

-- 7. Add RLS policies for pickup_requests
DO $$ 
BEGIN
  -- Enable RLS
  ALTER TABLE public.pickup_requests ENABLE ROW LEVEL SECURITY;

  -- View available requests
  CREATE POLICY view_available_requests ON public.pickup_requests
    FOR SELECT
    TO authenticated
    USING (status = 'available' AND (reserved_until IS NULL OR reserved_until < now()));

  -- View own reserved/accepted requests
  CREATE POLICY view_own_requests ON public.pickup_requests
    FOR SELECT
    TO authenticated
    USING (reserved_by = auth.uid() OR collector_id = auth.uid());

  -- Reserve available requests
  CREATE POLICY reserve_available_requests ON public.pickup_requests
    FOR UPDATE
    TO authenticated
    USING (status = 'available' AND (reserved_until IS NULL OR reserved_until < now()))
    WITH CHECK (reserved_by = auth.uid());

  -- Update own reserved/accepted requests
  CREATE POLICY update_own_requests ON public.pickup_requests
    FOR UPDATE
    TO authenticated
    USING (reserved_by = auth.uid() OR collector_id = auth.uid())
    WITH CHECK (reserved_by = auth.uid() OR collector_id = auth.uid());
END $$;

-- 4. Create request_notifications table for real-time updates
CREATE TABLE IF NOT EXISTS public.request_notifications (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  collector_id uuid NOT NULL REFERENCES auth.users(id),
  request_id text REFERENCES public.pickup_requests(id),
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

-- ============================================================================
-- SOP v4.5.6 PAYMENT MODEL EXTENSIONS (Collector-Only Implementation)
-- ============================================================================

-- 13. Add payment breakdown columns to pickup_requests
-- Note: Keeps existing 'fee' field for backwards compatibility
ALTER TABLE public.pickup_requests 
  -- Pricing breakdown (populated by user app/backend)
  ADD COLUMN IF NOT EXISTS base_amount DECIMAL DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS onsite_surcharges DECIMAL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS discount_amount DECIMAL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS urgent_enabled BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS urgent_amount DECIMAL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS distance_billed_km DECIMAL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS distance_amount DECIMAL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS surge_multiplier DECIMAL DEFAULT 1.0,
  ADD COLUMN IF NOT EXISTS surge_uplift_amount DECIMAL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS request_fee DECIMAL DEFAULT 1.0,
  ADD COLUMN IF NOT EXISTS taxes DECIMAL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_user_paid DECIMAL DEFAULT NULL,
  
  -- Distance anchors (T0, T1, T2) for fairness
  ADD COLUMN IF NOT EXISTS anchor_dmin_t0_km DECIMAL DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS anchor_d_accept_km DECIMAL DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS billed_km_quote DECIMAL DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS billed_km_final DECIMAL DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS anchors_computed_at TIMESTAMP DEFAULT NULL,
  
  -- Deadhead tracking (collector to pickup distance)
  ADD COLUMN IF NOT EXISTS deadhead_km DECIMAL DEFAULT NULL,
  
  -- Collector payout buckets (what collector earns)
  ADD COLUMN IF NOT EXISTS collector_core_payout DECIMAL DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS collector_urgent_payout DECIMAL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS collector_distance_payout DECIMAL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS collector_surge_payout DECIMAL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS collector_tips DECIMAL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS collector_recyclables_payout DECIMAL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS collector_loyalty_cashback DECIMAL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS collector_total_payout DECIMAL DEFAULT NULL,
  
  -- Platform revenue tracking
  ADD COLUMN IF NOT EXISTS platform_core_margin DECIMAL DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS platform_urgent_share DECIMAL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS platform_surge_share DECIMAL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS platform_recyclables_share DECIMAL DEFAULT 0,
  
  -- Recyclables async settlement
  ADD COLUMN IF NOT EXISTS has_recyclables BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS recycler_gross_payout DECIMAL DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS recyclables_settled_at TIMESTAMP DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS user_recyclables_credit DECIMAL DEFAULT 0;

-- 14. Create indexes for payment-related queries
CREATE INDEX IF NOT EXISTS idx_pickup_requests_urgent 
  ON public.pickup_requests(urgent_enabled) WHERE urgent_enabled = true;
  
CREATE INDEX IF NOT EXISTS idx_pickup_requests_surge 
  ON public.pickup_requests(surge_multiplier) WHERE surge_multiplier > 1.0;
  
CREATE INDEX IF NOT EXISTS idx_pickup_requests_recyclables 
  ON public.pickup_requests(has_recyclables) WHERE has_recyclables = true;
  
CREATE INDEX IF NOT EXISTS idx_pickup_requests_collector_payout 
  ON public.pickup_requests(collector_total_payout) WHERE collector_total_payout IS NOT NULL;

-- 15. Create collector_loyalty_tiers table
CREATE TABLE IF NOT EXISTS public.collector_loyalty_tiers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  collector_id UUID NOT NULL REFERENCES auth.users(id),
  month DATE NOT NULL, -- First day of month, e.g., '2025-01-01'
  tier VARCHAR(20) DEFAULT 'Silver', -- Silver, Gold, Platinum
  csat_score DECIMAL DEFAULT 0,
  completion_rate DECIMAL DEFAULT 0,
  recyclables_percentage DECIMAL DEFAULT 0,
  cashback_rate DECIMAL DEFAULT 0.01, -- 1%, 2%, 3%
  monthly_cap DECIMAL DEFAULT 100, -- ₵100, ₵200, ₵250
  cashback_earned DECIMAL DEFAULT 0,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now(),
  UNIQUE(collector_id, month)
);

-- 16. Create collector_tips table
CREATE TABLE IF NOT EXISTS public.collector_tips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID REFERENCES public.pickup_requests(id),
  collector_id UUID REFERENCES auth.users(id),
  user_id UUID,
  amount DECIMAL NOT NULL,
  tip_type VARCHAR(20) DEFAULT 'post_completion', -- pre_checkout, post_completion
  status VARCHAR(20) DEFAULT 'confirmed', -- pending, confirmed, refunded
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

-- 17. Create surge_events table
CREATE TABLE IF NOT EXISTS public.surge_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_name VARCHAR(100) NOT NULL,
  multiplier DECIMAL NOT NULL DEFAULT 1.2,
  start_time TIMESTAMP NOT NULL,
  end_time TIMESTAMP NOT NULL,
  region_filter JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

-- 18. Create payout_transactions table (detailed earnings log)
CREATE TABLE IF NOT EXISTS public.payout_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  collector_id UUID NOT NULL REFERENCES auth.users(id),
  request_id UUID REFERENCES public.pickup_requests(id),
  transaction_type VARCHAR(30) NOT NULL, -- core, urgent, distance, surge, tip, recyclables, loyalty
  amount DECIMAL NOT NULL,
  description TEXT,
  settled_at TIMESTAMP DEFAULT now(),
  created_at TIMESTAMP DEFAULT now()
);

-- 19. Add indexes for new tables
CREATE INDEX IF NOT EXISTS idx_loyalty_tiers_collector 
  ON public.collector_loyalty_tiers(collector_id, month);
  
CREATE INDEX IF NOT EXISTS idx_tips_collector 
  ON public.collector_tips(collector_id, created_at);
  
CREATE INDEX IF NOT EXISTS idx_tips_request 
  ON public.collector_tips(request_id);
  
CREATE INDEX IF NOT EXISTS idx_surge_events_active 
  ON public.surge_events(is_active, start_time, end_time) WHERE is_active = true;
  
CREATE INDEX IF NOT EXISTS idx_payout_transactions_collector 
  ON public.payout_transactions(collector_id, created_at);
  
CREATE INDEX IF NOT EXISTS idx_payout_transactions_type 
  ON public.payout_transactions(transaction_type, created_at);

-- 20. Enable RLS on new tables
ALTER TABLE public.collector_loyalty_tiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.collector_tips ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.surge_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payout_transactions ENABLE ROW LEVEL SECURITY;

-- 21. Create RLS policies for new tables
CREATE POLICY view_own_loyalty_tier ON public.collector_loyalty_tiers
  FOR SELECT TO authenticated USING (collector_id = auth.uid());

CREATE POLICY view_own_tips ON public.collector_tips
  FOR SELECT TO authenticated USING (collector_id = auth.uid());

CREATE POLICY view_active_surge_events ON public.surge_events
  FOR SELECT TO authenticated USING (is_active = true);

CREATE POLICY view_own_payout_transactions ON public.payout_transactions
  FOR SELECT TO authenticated USING (collector_id = auth.uid());

-- 22. Grant permissions for new tables
GRANT SELECT ON public.collector_loyalty_tiers TO authenticated;
GRANT SELECT ON public.collector_tips TO authenticated;
GRANT SELECT ON public.surge_events TO authenticated;
GRANT SELECT ON public.payout_transactions TO authenticated;
