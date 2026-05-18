-- ============================================================
-- Migration: withdrawal_items table + fix earnings/withdrawal RPCs
-- Date: 2026-05-17
-- Purpose:
--   1. Create withdrawal_items junction table so every withdrawal
--      links to the exact digital_bins / pickup_requests it covers.
--   2. Fix get_collector_available_earnings to use the ACTUAL
--      bin_payments.collector_share (gateway receipt) instead of
--      digital_bins.collector_total_payout (estimate).
--   3. Add disposed pickup_request earnings to withdrawable total.
--   4. Exclude items already covered by a non-failed withdrawal.
-- ============================================================

-- 1. Create withdrawal_items junction table
CREATE TABLE IF NOT EXISTS withdrawal_items (
  id          uuid        NOT NULL DEFAULT gen_random_uuid(),
  withdrawal_id uuid      NOT NULL,
  item_type   text        NOT NULL CHECK (item_type IN ('digital_bin', 'pickup_request')),
  item_id     text        NOT NULL,  -- text to accommodate both uuid (digital_bins) and text (pickup_requests)
  amount      numeric     NOT NULL CHECK (amount >= 0),
  created_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT withdrawal_items_pkey PRIMARY KEY (id),
  CONSTRAINT withdrawal_items_withdrawal_fkey FOREIGN KEY (withdrawal_id)
    REFERENCES withdrawals(id) ON DELETE CASCADE
);

-- Indexes for withdrawal_items
CREATE INDEX IF NOT EXISTS idx_withdrawal_items_withdrawal
  ON withdrawal_items(withdrawal_id);

CREATE INDEX IF NOT EXISTS idx_withdrawal_items_item
  ON withdrawal_items(item_type, item_id);

-- Grant access
GRANT SELECT, INSERT ON withdrawal_items TO authenticated;

-- ============================================================
-- 2. Fix get_collector_available_earnings
-- ============================================================
DROP FUNCTION IF EXISTS get_collector_available_earnings(uuid);

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

GRANT EXECUTE ON FUNCTION get_collector_available_earnings(uuid) TO authenticated;

-- ============================================================
-- 3. Re-create validate_cashout (calls the fixed function above)
-- ============================================================
DROP FUNCTION IF EXISTS validate_cashout(uuid, numeric);

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
  v_available := get_collector_available_earnings(p_collector_id);

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

  RETURN json_build_object(
    'valid', true,
    'available', v_available,
    'requested', p_amount,
    'remaining', v_available - p_amount
  );
END;
$$;

GRANT EXECUTE ON FUNCTION validate_cashout(uuid, numeric) TO authenticated;

-- ============================================================
-- 4. Update get_collector_earnings_breakdown to include pickups
-- ============================================================
DROP FUNCTION IF EXISTS get_collector_earnings_breakdown(uuid);

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

-- ============================================================
-- 5. Update get_collector_total_disbursed to include withdrawals
-- ============================================================
DROP FUNCTION IF EXISTS get_collector_total_disbursed(uuid);

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
