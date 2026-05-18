-- ========================================
-- Digital Bin Payment System - Database Setup
-- ========================================
-- Run this SQL in your Supabase SQL Editor
-- ========================================

-- Drop existing functions first to allow return-type changes
DROP FUNCTION IF EXISTS get_collector_available_earnings(uuid);
DROP FUNCTION IF EXISTS validate_cashout(uuid, numeric);
DROP FUNCTION IF EXISTS get_collector_earnings_breakdown(uuid);
DROP FUNCTION IF EXISTS get_collector_total_disbursed(uuid);

-- 1. RPC Function: Get Collector Available Earnings
-- Returns the sum of undisbursed earnings for a collector.
-- Digital bins: uses bin_payments.collector_share (actual gateway receipt, not estimate).
-- Pickup requests: uses collector_total_payout (prepaid, fixed fee).
-- Cash-payment bins are excluded: collector already received that cash.
CREATE OR REPLACE FUNCTION get_collector_available_earnings(p_collector_id uuid)
RETURNS numeric
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT
    -- Part A: Digital bin earnings (actual gateway receipts)
    COALESCE((
      SELECT SUM(bp.collector_share)
      FROM bin_payments bp
      INNER JOIN digital_bins db ON db.id = bp.digital_bin_id
      WHERE db.collector_id = p_collector_id
        AND db.status = 'disposed'
        AND bp.type = 'collection'
        AND bp.status != 'failed'
        AND bp.payment_mode IN ('momo', 'e_cash')
        -- Exclude bins already in a non-failed withdrawal (new system)
        AND db.id::text NOT IN (
          SELECT wi.item_id
          FROM withdrawal_items wi
          INNER JOIN withdrawals w ON w.id = wi.withdrawal_id
          WHERE wi.item_type = 'digital_bin'
            AND w.status NOT IN ('failed', 'cancelled')
        )
        -- Exclude bins already disbursed via legacy bin_payments system
        AND db.id NOT IN (
          SELECT bp2.digital_bin_id
          FROM bin_payments bp2
          WHERE bp2.type = 'disbursement'
            AND bp2.status = 'success'
            AND bp2.digital_bin_id IS NOT NULL
        )
    ), 0)
    +
    -- Part B: Pickup request earnings (prepaid, fixed fee)
    COALESCE((
      SELECT SUM(pr.collector_total_payout)
      FROM pickup_requests pr
      WHERE pr.collector_id = p_collector_id
        AND pr.status = 'disposed'
        AND pr.collector_total_payout IS NOT NULL
        AND pr.collector_total_payout > 0
        -- Exclude requests already in a non-failed withdrawal
        AND pr.id NOT IN (
          SELECT wi.item_id
          FROM withdrawal_items wi
          INNER JOIN withdrawals w ON w.id = wi.withdrawal_id
          WHERE wi.item_type = 'pickup_request'
            AND w.status NOT IN ('failed', 'cancelled')
        )
    ), 0);
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_collector_available_earnings(uuid) TO authenticated;

-- 2. RPC Function: Validate Cashout Amount
-- Checks if collector has sufficient balance for withdrawal
CREATE OR REPLACE FUNCTION validate_cashout(
  p_collector_id uuid,
  p_amount numeric
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_available numeric;
BEGIN
  -- Get available earnings
  v_available := get_collector_available_earnings(p_collector_id);
  
  -- Validate amount
  IF p_amount <= 0 THEN
    RETURN json_build_object(
      'valid', false,
      'error', 'Amount must be greater than zero',
      'available', v_available
    );
  END IF;
  
  IF p_amount > v_available THEN
    RETURN json_build_object(
      'valid', false,
      'error', 'Insufficient balance',
      'available', v_available,
      'requested', p_amount
    );
  END IF;
  
  -- All checks passed
  RETURN json_build_object(
    'valid', true,
    'available', v_available,
    'requested', p_amount,
    'remaining', v_available - p_amount
  );
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION validate_cashout(uuid, numeric) TO authenticated;

-- 3. RPC Function: Get Earnings Breakdown
-- Returns detailed breakdown of collector earnings by component (bins + pickups)
CREATE OR REPLACE FUNCTION get_collector_earnings_breakdown(p_collector_id uuid)
RETURNS json
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT json_build_object(
    'digital_bins', (
      SELECT json_build_object(
        'total_earnings', COALESCE(SUM(collector_total_payout), 0),
        'core_payout',    COALESCE(SUM(collector_core_payout), 0),
        'urgent_payout',  COALESCE(SUM(collector_urgent_payout), 0),
        'distance_payout',COALESCE(SUM(collector_distance_payout), 0),
        'surge_payout',   COALESCE(SUM(collector_surge_payout), 0),
        'tips',           COALESCE(SUM(collector_tips), 0),
        'recyclables_payout', COALESCE(SUM(collector_recyclables_payout), 0),
        'loyalty_cashback',   COALESCE(SUM(collector_loyalty_cashback), 0),
        'count',          COUNT(*)
      )
      FROM digital_bins
      WHERE collector_id = p_collector_id AND status = 'disposed'
    ),
    'pickup_requests', (
      SELECT json_build_object(
        'total_earnings', COALESCE(SUM(collector_total_payout), 0),
        'core_payout',    COALESCE(SUM(collector_core_payout), 0),
        'urgent_payout',  COALESCE(SUM(collector_urgent_payout), 0),
        'distance_payout',COALESCE(SUM(collector_distance_payout), 0),
        'surge_payout',   COALESCE(SUM(collector_surge_payout), 0),
        'tips',           COALESCE(SUM(collector_tips), 0),
        'recyclables_payout', COALESCE(SUM(collector_recyclables_payout), 0),
        'loyalty_cashback',   COALESCE(SUM(collector_loyalty_cashback), 0),
        'count',          COUNT(*)
      )
      FROM pickup_requests
      WHERE collector_id = p_collector_id AND status = 'disposed'
    )
  );
$$;

GRANT EXECUTE ON FUNCTION get_collector_earnings_breakdown(uuid) TO authenticated;

-- 4. RPC Function: Get Total Disbursed Amount
-- Returns how much has already been paid out to collector (new + legacy systems)
CREATE OR REPLACE FUNCTION get_collector_total_disbursed(p_collector_id uuid)
RETURNS numeric
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT
    -- New system: withdrawals table
    COALESCE((
      SELECT SUM(w.amount)
      FROM withdrawals w
      WHERE w.collector_id = p_collector_id
        AND w.status = 'completed'
    ), 0)
    +
    -- Legacy: bin_payments disbursement records
    COALESCE((
      SELECT SUM(bp.collector_share)
      FROM bin_payments bp
      WHERE bp.collector_id IN (
        SELECT id FROM collector_profiles WHERE user_id = p_collector_id
      )
        AND bp.type = 'disbursement'
        AND bp.status = 'success'
    ), 0);
$$;

GRANT EXECUTE ON FUNCTION get_collector_total_disbursed(uuid) TO authenticated;

-- ========================================
-- INDEXES for Performance
-- ========================================

-- Index on digital_bins for faster earnings queries
CREATE INDEX IF NOT EXISTS idx_digital_bins_collector_status 
ON digital_bins(collector_id, status)
WHERE status = 'disposed';

-- Index on digital_bins for payout calculations
CREATE INDEX IF NOT EXISTS idx_digital_bins_collector_payout 
ON digital_bins(collector_id, collector_total_payout)
WHERE status = 'disposed';

-- Index on bin_payments for disbursement lookups
CREATE INDEX IF NOT EXISTS idx_bin_payments_type_status 
ON bin_payments(type, status);

-- Index on bin_payments for collector disbursements
CREATE INDEX IF NOT EXISTS idx_bin_payments_collector_disbursement 
ON bin_payments(collector_id, type, status)
WHERE type = 'disbursement';

-- Index on bin_payments for digital bin lookups
CREATE INDEX IF NOT EXISTS idx_bin_payments_digital_bin 
ON bin_payments(digital_bin_id, type);

-- Covering index for get_collector_available_earnings JOIN:
-- filters on (digital_bin_id, type, status, payment_mode) for collection rows
CREATE INDEX IF NOT EXISTS idx_bin_payments_collection_mode
ON bin_payments(digital_bin_id, payment_mode, status)
WHERE type = 'collection' AND status != 'failed';

-- Index on bin_payments for gateway references (webhook lookups)
CREATE INDEX IF NOT EXISTS idx_bin_payments_gateway_transaction 
ON bin_payments(gateway_transaction_id)
WHERE gateway_transaction_id IS NOT NULL;

-- ========================================
-- ADD COLUMNS (if not already present)
-- ========================================

-- Add gateway columns to bin_payments if they don't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'bin_payments' AND column_name = 'gateway_transaction_id'
  ) THEN
    ALTER TABLE bin_payments ADD COLUMN gateway_transaction_id TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'bin_payments' AND column_name = 'gateway_error'
  ) THEN
    ALTER TABLE bin_payments ADD COLUMN gateway_error TEXT;
  END IF;
END $$;

-- ========================================
-- VERIFICATION QUERIES
-- ========================================
-- Run these to test the functions

-- Test 1: Get available earnings for a collector
-- Replace 'your-collector-user-id' with actual UUID
-- SELECT get_collector_available_earnings('your-collector-user-id'::uuid);

-- Test 2: Validate a cashout amount
-- SELECT validate_cashout('your-collector-user-id'::uuid, 50.00);

-- Test 3: Get earnings breakdown
-- SELECT get_collector_earnings_breakdown('your-collector-user-id'::uuid);

-- Test 4: Get total disbursed
-- SELECT get_collector_total_disbursed('your-collector-user-id'::uuid);

-- Test 5: Check if indexes were created
SELECT 
  schemaname,
  tablename,
  indexname
FROM pg_indexes
WHERE tablename IN ('digital_bins', 'bin_payments')
  AND indexname LIKE 'idx_%'
ORDER BY tablename, indexname;

-- ========================================
-- SAMPLE DATA (Optional - for testing)
-- ========================================

-- Insert sample disposed bin (replace UUIDs with your test data)
/*
INSERT INTO digital_bins (
  id, user_id, collector_id, location_id, status,
  collector_core_payout, collector_urgent_payout, collector_distance_payout,
  collector_surge_payout, collector_tips, collector_recyclables_payout,
  collector_loyalty_cashback, collector_total_payout,
  disposed_at
) VALUES (
  gen_random_uuid(),
  'client-user-id'::uuid,
  'collector-user-id'::uuid,
  'location-1',
  'disposed',
  16.00, -- core
  0.00,  -- urgent
  4.80,  -- distance
  0.00,  -- surge
  5.00,  -- tips
  5.40,  -- recyclables
  1.28,  -- loyalty
  31.84, -- total
  NOW()
);
*/

-- ========================================
-- CLEANUP (if you need to start over)
-- ========================================

/*
-- Drop functions
DROP FUNCTION IF EXISTS get_collector_available_earnings(uuid);
DROP FUNCTION IF EXISTS validate_cashout(uuid, numeric);
DROP FUNCTION IF EXISTS get_collector_earnings_breakdown(uuid);
DROP FUNCTION IF EXISTS get_collector_total_disbursed(uuid);

-- Drop indexes
DROP INDEX IF EXISTS idx_digital_bins_collector_status;
DROP INDEX IF EXISTS idx_digital_bins_collector_payout;
DROP INDEX IF EXISTS idx_bin_payments_type_status;
DROP INDEX IF EXISTS idx_bin_payments_collector_disbursement;
DROP INDEX IF EXISTS idx_bin_payments_digital_bin;
DROP INDEX IF EXISTS idx_bin_payments_gateway_transaction;
*/
