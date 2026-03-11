-- Migration: Add 'en_route' and 'arrived' statuses to pickup_requests and digital_bins
-- These statuses enable the client's Active Pickup modal to show all 5 progress steps:
-- 1. Accepted → 2. En Route → 3. Arrived → 4. Picked Up → 5. Disposed

-- If pickup_requests.status uses a CHECK constraint, update it to allow new values
-- First, drop the old constraint if it exists (safe - no-op if not present)
DO $$
BEGIN
  -- Try to drop existing check constraint on pickup_requests.status
  ALTER TABLE pickup_requests DROP CONSTRAINT IF EXISTS pickup_requests_status_check;
  
  -- Add updated check constraint with new statuses
  ALTER TABLE pickup_requests ADD CONSTRAINT pickup_requests_status_check 
    CHECK (status IN ('available', 'accepted', 'en_route', 'arrived', 'picked_up', 'disposed', 'completed', 'canceled', 'expired', 'cancelled'));

EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'pickup_requests status constraint update skipped: %', SQLERRM;
END $$;

-- Same for digital_bins table
DO $$
BEGIN
  ALTER TABLE digital_bins DROP CONSTRAINT IF EXISTS digital_bins_status_check;
  
  ALTER TABLE digital_bins ADD CONSTRAINT digital_bins_status_check 
    CHECK (status IN ('available', 'accepted', 'en_route', 'arrived', 'picked_up', 'disposed', 'completed', 'canceled', 'expired'));

EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'digital_bins status constraint update skipped: %', SQLERRM;
END $$;

-- If using a PostgreSQL enum type instead of CHECK constraints:
-- Uncomment the following if your status column uses a custom enum type

-- DO $$
-- BEGIN
--   ALTER TYPE pickup_request_status ADD VALUE IF NOT EXISTS 'en_route';
--   ALTER TYPE pickup_request_status ADD VALUE IF NOT EXISTS 'arrived';
-- EXCEPTION WHEN OTHERS THEN
--   RAISE NOTICE 'Enum type update skipped: %', SQLERRM;
-- END $$;

-- Add index for the new statuses to optimize queries
CREATE INDEX IF NOT EXISTS idx_pickup_requests_en_route 
  ON pickup_requests (collector_id) 
  WHERE status IN ('accepted', 'en_route', 'arrived');

CREATE INDEX IF NOT EXISTS idx_digital_bins_en_route 
  ON digital_bins (collector_id) 
  WHERE status IN ('accepted', 'en_route', 'arrived');
